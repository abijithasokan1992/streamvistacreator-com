// Client-side driver for the `oci-multipart` edge function.
//
// Files > 5MB are chunked here and PUT directly to OCI Object Storage using
// signed Authorization headers returned by the edge function. Single-shot
// uploads (< 5MB) continue to use the existing `oci-upload` path.
//
// Resume strategy:
//  - Same browser: the caller passes a stable `pendingId` (persisted in
//    localStorage) so `init` returns the existing oci_upload_id.
//  - Cross-device: if the caller passes `fileSha256`, we first call `lookup`
//    and reuse the matching pending session, asking OCI which parts already
//    landed so we only re-send the missing tail.

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const FN_URL = `${SUPABASE_URL}/functions/v1/oci-multipart`;

// 8 MB default chunk — well above OCI's 5MB minimum and friendly to retries.
const DEFAULT_PART_SIZE = 8 * 1024 * 1024;
// Anything at/above this routes through multipart.
export const MULTIPART_THRESHOLD = 5 * 1024 * 1024;

type InvokeOpts = { signal?: AbortSignal };

async function invoke<T>(action: string, body: Record<string, unknown>, opts: InvokeOpts = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in");
  const resp = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
    signal: opts.signal,
  });
  const text = await resp.text();
  let parsed: any = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* keep raw */ }
  if (!resp.ok) {
    throw new Error(parsed?.error || `oci-multipart ${action} ${resp.status}`);
  }
  return parsed as T;
}

async function sha256Base64(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function putChunkWithRetry(
  url: string,
  headers: Record<string, string>,
  body: ArrayBuffer,
  attempts = 3,
  signal?: AbortSignal,
): Promise<{ etag: string; status: number; durationMs: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const started = performance.now();
    try {
      // Browsers refuse to set host/date/content-length manually — OCI accepts
      // the request anyway because those values are derived from the URL and
      // the body, matching the signed values exactly.
      const safeHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(headers)) {
        const lk = k.toLowerCase();
        if (lk === "host" || lk === "content-length") continue;
        safeHeaders[k] = v;
      }
      const resp = await fetch(url, { method: "PUT", headers: safeHeaders, body, signal });
      const durationMs = Math.round(performance.now() - started);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`OCI PUT ${resp.status}: ${text.slice(0, 200)}`);
      }
      const etag = (resp.headers.get("etag") || resp.headers.get("ETag") || "").replace(/^"|"$/g, "");
      if (!etag) throw new Error("OCI did not return ETag");
      return { etag, status: resp.status, durationMs };
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
      // Exponential backoff: 500ms, 1.5s
      await new Promise((r) => setTimeout(r, 500 * Math.pow(3, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("chunk upload failed");
}

export type MultipartProgress = (loaded: number, total: number) => void;

export type MultipartParams = {
  file: File;
  workspaceId: string;
  pendingId: string;             // stable id (also persisted to localStorage)
  projectId?: string | null;
  category?: string | null;
  subpath?: string | null;
  onProgress?: MultipartProgress;
  signal?: AbortSignal;
  /** Optional pre-computed whole-file SHA-256 (hex) for cross-device resume. */
  fileSha256Hex?: string;
};

export type MultipartResult = { upload: any };

export async function uploadFileMultipart(p: MultipartParams): Promise<MultipartResult> {
  const { file, workspaceId, pendingId, onProgress, signal } = p;
  const partSize = DEFAULT_PART_SIZE;
  const totalChunks = Math.max(1, Math.ceil(file.size / partSize));

  // 1) INIT (idempotent on pendingId — returns resumed=true with same uploadId)
  type InitResp = {
    uploadRowId: string;
    uploadId: string;
    objectKey: string;
    partSize: number;
    upload?: any;
    idempotent?: boolean;
    resumed?: boolean;
  };
  const init = await invoke<InitResp>("init", {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    workspaceId,
    pendingId,
    projectId: p.projectId ?? undefined,
    category: p.category ?? undefined,
    subpath: p.subpath ?? undefined,
    fileSha256: p.fileSha256Hex ?? undefined,
    totalChunks,
  }, { signal });

  if (init.idempotent && init.upload) {
    onProgress?.(file.size, file.size);
    return { upload: init.upload };
  }

  const { uploadRowId, uploadId } = init;
  const usePartSize = init.partSize || partSize;
  const recomputedTotal = Math.max(1, Math.ceil(file.size / usePartSize));

  // 2) LIST parts already on OCI (so resume only sends what's missing).
  const listed = await invoke<{ parts: Array<{ partNumber: number; etag: string; size?: number }> }>(
    "list_parts", { uploadRowId, uploadId }, { signal },
  ).catch(() => ({ parts: [] }));
  const completed = new Map<number, string>();
  for (const part of listed.parts) completed.set(part.partNumber, part.etag);

  // 3) Upload missing parts sequentially with retries.
  let loaded = Math.min(file.size, completed.size * usePartSize);
  onProgress?.(loaded, file.size);

  for (let partNumber = 1; partNumber <= recomputedTotal; partNumber++) {
    if (signal?.aborted) throw new Error("aborted");
    if (completed.has(partNumber)) continue;

    const start = (partNumber - 1) * usePartSize;
    const end = Math.min(start + usePartSize, file.size);
    const blob = file.slice(start, end);
    const buf = await blob.arrayBuffer();
    const contentLength = buf.byteLength;
    const contentSha256 = await sha256Base64(buf);

    const sign = await invoke<{ url: string; headers: Record<string, string> }>(
      "sign_part",
      { uploadRowId, uploadId, partNumber, contentSha256, contentLength },
      { signal },
    );

    try {
      const put = await putChunkWithRetry(sign.url, sign.headers, buf, 3, signal);
      completed.set(partNumber, put.etag);
      loaded += contentLength;
      onProgress?.(Math.min(loaded, file.size), file.size);
      // Best-effort telemetry — never fails the upload.
      invoke("report_part", {
        uploadId, partNumber, ok: true,
        httpStatus: put.status, durationMs: put.durationMs, bytes: contentLength,
      }).catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      invoke("report_part", {
        uploadId, partNumber, ok: false, bytes: contentLength, error: msg,
      }).catch(() => {});
      throw e;
    }
  }

  // 4) COMPLETE
  const parts = Array.from(completed.entries())
    .sort(([a], [b]) => a - b)
    .map(([partNumber, etag]) => ({ partNumber, etag }));
  const done = await invoke<{ upload: any }>("complete", { uploadRowId, uploadId, parts }, { signal });
  onProgress?.(file.size, file.size);
  return { upload: done.upload };
}

export async function abortMultipart(uploadRowId: string, uploadId: string): Promise<void> {
  await invoke("abort", { uploadRowId, uploadId }).catch(() => {});
}
