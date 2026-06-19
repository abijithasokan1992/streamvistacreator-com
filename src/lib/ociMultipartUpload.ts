// Client-side driver for the `oci-multipart` edge function.
//
// Files > 5MB are chunked here and PUT directly to OCI Object Storage using
// signed Authorization headers returned by the edge function. Single-shot
// uploads (≤ 5MB) continue to use the existing `oci-upload` path.
//
// Resume strategy (in priority order):
//  1. Cross-device by SHA-256 — `lookup` returns the pending upload_sessions
//     row for any prior device, and we query recent_uploads for its row id so
//     we can call sign_part/complete without re-initializing on OCI.
//  2. Same browser by pendingId — init is idempotent on pendingId, so a
//     re-drop of the same File handle reuses the existing oci_upload_id.

import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const FN_URL = `${SUPABASE_URL}/functions/v1/oci-multipart`;

// Phase 11: adaptive part size. OCI caps at 10,000 parts per upload.
//   5 MB  → 50 GB max  (legacy)
//   64 MB → 640 GB max (default)
//  128 MB → 1.28 TB max (enterprise tier, files > 500 GB)
const PART_SIZE_DEFAULT = 64 * 1024 * 1024;
const PART_SIZE_LARGE   = 128 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024 * 1024; // 500 GB
function pickPartSize(fileSize: number): number {
  return fileSize > LARGE_FILE_THRESHOLD ? PART_SIZE_LARGE : PART_SIZE_DEFAULT;
}
// Files at/above this go through multipart; smaller stay on single-shot.
export const MULTIPART_THRESHOLD = 5 * 1024 * 1024;
// Phase 11: 4-way concurrent chunk workers.
const UPLOAD_CONCURRENCY = 4;
// Skip whole-file SHA for very large files to avoid loading them into memory.
const SHA_MAX_BYTES = 1.5 * 1024 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Phase 10: persistent resume registry (browser-refresh / crash recovery).
// Files >1.5 GB cannot be re-fingerprinted via SHA (would OOM the tab).
// Instead we persist {uploadRowId, uploadId, pendingId, titleId, workspaceId,
// category} in localStorage keyed by a cheap file fingerprint
// (name|size|lastModified). On a fresh File handle for the same physical
// file, we re-discover the session and skip `init` entirely. The entry is
// cleared on `complete` or on a hard, non-resumable failure.
const REGISTRY_PREFIX = "oci-resume:v1:";
const REGISTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type ResumeEntry = {
  uploadRowId: string;
  uploadId: string;
  pendingId: string;
  titleId?: string | null;
  workspaceId: string;
  category?: string | null;
  fileName: string;
  fileSize: number;
  lastModified: number;
  savedAt: number;
};

function fingerprintKey(file: File): string {
  return `${REGISTRY_PREFIX}${file.name}|${file.size}|${file.lastModified}`;
}

function loadResumeEntry(file: File): ResumeEntry | null {
  try {
    const raw = localStorage.getItem(fingerprintKey(file));
    if (!raw) return null;
    const entry = JSON.parse(raw) as ResumeEntry;
    if (Date.now() - entry.savedAt > REGISTRY_TTL_MS) {
      localStorage.removeItem(fingerprintKey(file));
      return null;
    }
    if (entry.fileSize !== file.size || entry.fileName !== file.name) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveResumeEntry(
  file: File,
  entry: Omit<ResumeEntry, "fileName" | "fileSize" | "lastModified" | "savedAt">,
) {
  try {
    const full: ResumeEntry = {
      ...entry,
      fileName: file.name,
      fileSize: file.size,
      lastModified: file.lastModified,
      savedAt: Date.now(),
    };
    localStorage.setItem(fingerprintKey(file), JSON.stringify(full));
  } catch { /* quota / private-mode — non-fatal */ }
}

function clearResumeEntry(file: File) {
  try { localStorage.removeItem(fingerprintKey(file)); } catch { /* ignore */ }
}

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
  if (!resp.ok) throw new Error(parsed?.error || `oci-multipart ${action} ${resp.status}`);
  return parsed as T;
}

async function sha256Base64(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

/** Whole-file SHA-256 (hex) — used by `lookup` for cross-device resume. */
async function fileSha256Hex(file: File): Promise<string | null> {
  if (file.size > SHA_MAX_BYTES) return null;
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
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
      // Browsers refuse to set host/content-length — OCI accepts the request
      // because those values are derived from the URL/body and match what was
      // signed server-side.
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
      await new Promise((r) => setTimeout(r, 500 * Math.pow(3, i)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("chunk upload failed");
}

/** Error thrown when the upload was interrupted but is fully resumable. */
export class ResumableUploadInterrupted extends Error {
  resumable = true as const;
  constructor(message: string, public partNumber: number, public totalChunks: number) {
    super(message);
    this.name = "ResumableUploadInterrupted";
  }
}

export type MultipartProgress = (loaded: number, total: number) => void;

export type MultipartParams = {
  file: File;
  workspaceId: string;
  pendingId: string;
  projectId?: string | null;
  titleId?: string | null;
  category?: string | null;
  subpath?: string | null;
  onProgress?: MultipartProgress;
  signal?: AbortSignal;
};

export type MultipartResult = { upload: any; resumed?: boolean };

export async function uploadFileMultipart(p: MultipartParams): Promise<MultipartResult> {
  const { file, workspaceId, pendingId, onProgress, signal } = p;
  const PART_SIZE = pickPartSize(file.size);
  const totalChunks = Math.max(1, Math.ceil(file.size / PART_SIZE));

  // 0) Hash the file for cross-device resume (skipped for >1.5GB files).
  const shaHex = await fileSha256Hex(file);

  let uploadRowId: string | null = null;
  let uploadId: string | null = null;
  let effectivePendingId = pendingId;
  let resumedFromLookup = false;

  // 1a) LOCAL REGISTRY — fastest path, works for any file size including >1.5GB.
  const local = loadResumeEntry(file);
  if (local && local.workspaceId === workspaceId) {
    try {
      await invoke<{ parts: Array<{ partNumber: number; etag: string }> }>(
        "list_parts",
        { uploadRowId: local.uploadRowId, uploadId: local.uploadId },
        { signal },
      );
      uploadRowId = local.uploadRowId;
      uploadId = local.uploadId;
      effectivePendingId = local.pendingId;
      resumedFromLookup = true;
    } catch {
      clearResumeEntry(file);
    }
  }

  // 1b) SHA LOOKUP — cross-device resume (only for files ≤1.5GB).
  if (!uploadRowId && shaHex) {
    try {
      const lk = await invoke<{
        found: boolean;
        session?: { id: string; oci_upload_id: string };
      }>("lookup", { fileSha256: shaHex }, { signal });
      if (lk.found && lk.session?.oci_upload_id) {
        const { data: row } = await supabase
          .from("recent_uploads")
          .select("id")
          .eq("oci_upload_id", lk.session.oci_upload_id)
          .maybeSingle();
        if (row?.id) {
          uploadRowId = row.id;
          uploadId = lk.session.oci_upload_id;
          resumedFromLookup = true;
        }
      }
    } catch { /* non-fatal */ }
  }

  // 2) INIT
  if (!uploadRowId || !uploadId) {
    type InitResp = {
      uploadRowId: string;
      uploadId: string;
      upload?: any;
      idempotent?: boolean;
    };
    const init = await invoke<InitResp>("init", {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      workspaceId,
      pendingId: effectivePendingId,
      projectId: p.projectId ?? undefined,
      titleId: p.titleId ?? undefined,
      category: p.category ?? undefined,
      subpath: p.titleId ? undefined : (p.subpath ?? undefined),
      fileSha256: shaHex ?? undefined,
      totalChunks,
    }, { signal });

    if (init.idempotent && init.upload) {
      onProgress?.(file.size, file.size);
      clearResumeEntry(file);
      return { upload: init.upload };
    }
    uploadRowId = init.uploadRowId;
    uploadId = init.uploadId;
  }

  saveResumeEntry(file, {
    uploadRowId: uploadRowId!,
    uploadId: uploadId!,
    pendingId: effectivePendingId,
    titleId: p.titleId ?? null,
    workspaceId,
    category: p.category ?? null,
  });

  // 3) LIST already-uploaded parts
  const listed = await invoke<{ parts: Array<{ partNumber: number; etag: string }> }>(
    "list_parts", { uploadRowId, uploadId }, { signal },
  ).catch(() => ({ parts: [] as Array<{ partNumber: number; etag: string }> }));
  const completed = new Map<number, string>();
  for (const part of listed.parts) completed.set(part.partNumber, part.etag);

  let loaded = Math.min(file.size, completed.size * PART_SIZE);
  onProgress?.(loaded, file.size);

  // 4) PHASE 11: parallel chunk workers (4-way pool).
  // Workers pull part numbers from a shared queue; completed/loaded/onProgress
  // are mutated under the single-threaded JS event loop so no locking needed.
  const queue: number[] = [];
  for (let n = 1; n <= totalChunks; n++) if (!completed.has(n)) queue.push(n);

  let firstError: unknown = null;
  let firstErrorPart = 0;

  async function worker() {
    while (queue.length > 0 && !firstError) {
      if (signal?.aborted) throw new Error("aborted");
      const partNumber = queue.shift();
      if (partNumber === undefined) return;

      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const buf = await file.slice(start, end).arrayBuffer();
      const contentLength = buf.byteLength;
      const contentSha256 = await sha256Base64(buf);

      try {
        const sign = await invoke<{ url: string; headers: Record<string, string> }>(
          "sign_part",
          { uploadRowId, uploadId, partNumber, contentSha256, contentLength },
          { signal },
        );
        const put = await putChunkWithRetry(sign.url, sign.headers, buf, 3, signal);
        completed.set(partNumber, put.etag);
        loaded += contentLength;
        onProgress?.(Math.min(loaded, file.size), file.size);
        invoke("report_part", {
          uploadId, partNumber, ok: true,
          httpStatus: put.status, durationMs: put.durationMs, bytes: contentLength,
        }).catch(() => {});
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        invoke("report_part", {
          uploadId, partNumber, ok: false, bytes: contentLength, error: msg,
        }).catch(() => {});
        if (!firstError) {
          firstError = e;
          firstErrorPart = partNumber;
        }
        return;
      }
    }
  }

  const workerCount = Math.min(UPLOAD_CONCURRENCY, Math.max(1, queue.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (firstError) {
    const msg = firstError instanceof Error ? firstError.message : String(firstError);
    throw new ResumableUploadInterrupted(msg, firstErrorPart, totalChunks);
  }

  // 5) COMPLETE
  const parts = Array.from(completed.entries())
    .sort(([a], [b]) => a - b)
    .map(([partNumber, etag]) => ({ partNumber, etag }));
  const done = await invoke<{ upload: any }>("complete", { uploadRowId, uploadId, parts }, { signal });
  onProgress?.(file.size, file.size);
  clearResumeEntry(file);
  return { upload: done.upload, resumed: resumedFromLookup };
}

export async function abortMultipart(uploadRowId: string, uploadId: string): Promise<void> {
  await invoke("abort", { uploadRowId, uploadId }).catch(() => {});
}
