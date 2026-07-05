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

// Phase 11/Stream 5C: adaptive part size. Server is source of truth; client
// recommends a size based on file size and clamps to whatever the server says.
//   < 500 MB   →  16 MB chunks
//   500 MB-5 GB →  32 MB chunks
//   5-50 GB    →  64 MB chunks
//   ≥ 50 GB    → 128 MB chunks
const PART_SIZE_LARGE = 128 * 1024 * 1024;
function recommendPartSize(fileSize: number): number {
  if (fileSize < 500 * 1024 * 1024) return 16 * 1024 * 1024;
  if (fileSize < 5 * 1024 * 1024 * 1024) return 32 * 1024 * 1024;
  if (fileSize < 50 * 1024 * 1024 * 1024) return 64 * 1024 * 1024;
  return PART_SIZE_LARGE;
}
// Files at/above this go through multipart; smaller stay on single-shot.
export const MULTIPART_THRESHOLD = 5 * 1024 * 1024;
// Phase 11: 4-way concurrent chunk workers (default; server may override).
const UPLOAD_CONCURRENCY_DEFAULT = 4;
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

/** Thrown when the OCI multipart upload has expired / been aborted. Caller must
 *  clean local state and re-init from scratch with a fresh pendingId. */
export class UploadSessionExpiredError extends Error {
  code = "upload_session_expired" as const;
  constructor(message: string) { super(message); this.name = "UploadSessionExpiredError"; }
}

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
  if (resp.status === 410 || parsed?.code === "upload_not_found") {
    throw new UploadSessionExpiredError(parsed?.error || "upload_not_found");
  }
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
        // Terminal for this multipart session — do NOT retry, surface so the
        // caller can clean state and re-init from scratch.
        if (resp.status === 404 && /UploadNotFound/i.test(text)) {
          throw new UploadSessionExpiredError(`OCI PUT 404: ${text.slice(0, 200)}`);
        }
        throw new Error(`OCI PUT ${resp.status}: ${text.slice(0, 200)}`);
      }
      const etag = (resp.headers.get("etag") || resp.headers.get("ETag") || "").replace(/^"|"$/g, "");
      if (!etag) throw new Error("OCI did not return ETag");
      return { etag, status: resp.status, durationMs };
    } catch (e) {
      if (e instanceof UploadSessionExpiredError) throw e;
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
export type UploadStage =
  | "initializing"
  | "signing"
  | "uploading"
  | "verifying"
  | "completing"
  | "registering"
  | "metadata"
  | "complete";
export type UploadTelemetry = {
  stage: UploadStage;
  loaded: number;
  total: number;
  partsDone: number;
  totalParts: number;
  speedBps: number;        // bytes per second (rolling)
  etaSeconds: number | null;
};

export type MultipartParams = {
  file: File;
  workspaceId: string;
  pendingId: string;
  projectId?: string | null;
  titleId?: string | null;
  category?: string | null;
  subpath?: string | null;
  onProgress?: MultipartProgress;
  onTelemetry?: (t: UploadTelemetry) => void;
  signal?: AbortSignal;
};

export type MultipartResult = { upload: any; resumed?: boolean };

export class UploadContractError extends Error {
  code = "upload_contract_mismatch" as const;
  constructor(message: string) {
    super(message);
    this.name = "UploadContractError";
  }
}

/** Map raw internal errors into safe, user-friendly messages.
 *  Preserves the real server error when it's already user-safe (quota,
 *  category, MIME, forbidden, OCI status code) — only collapses to a
 *  generic message when the underlying error is genuinely opaque. */
export function mapUploadError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  const m = msg.toLowerCase();

  // Client-side contract mismatch (rare; surfaces as actionable copy).
  if (m.includes("part exceeds") || m.includes("upload_contract_mismatch")) {
    return "Upload could not start because of a chunk-size mismatch. Refresh the page and try again — if it persists, contact support.";
  }
  // Server-tagged validation rejections — message is already safe to show.
  if (m.includes("forbidden_file_type") || m.includes("category_mime_mismatch")
      || m.includes("upload not allowed") || m.includes("blocked for security")) {
    return msg;
  }
  if (m.includes("exceeds category limit")) return msg;
  if (m.includes("storage limit reached") || m.includes("storage_quota") || m.includes("storage quota")) {
    return msg.includes("storage limit reached")
      ? msg
      : "Upload blocked — your workspace storage quota has been reached. Add another 1 TB block in Storage & Billing.";
  }
  if (m.includes("forbidden_workspace") || m.includes("forbidden_title")) {
    return "You don't have permission to upload to this workspace or title.";
  }
  if (m.includes("not signed in") || m.includes("invalid token") || m.includes("unauthenticated")) {
    return "Please sign in again to continue uploading.";
  }
  if (m.includes("aborted")) return "Upload was cancelled.";

  // OCI-side errors: surface the status code + first chunk of the OCI body so
  // ops can diagnose. These messages already come pre-formatted from the
  // signing/PUT layer (e.g. "OCI PUT 401: NotAuthenticated …").
  if (m.includes("oci put") || m.includes("oci ") || m.includes("notauthenticated") || m.includes("objectstorage")) {
    return `Storage upload failed — ${msg.slice(0, 240)}`;
  }
  if (m.includes("oci did not return etag")) {
    return "Storage upload failed — part was rejected by object storage. Please retry.";
  }
  if (m.includes("upload_not_found") || m.includes("upload session") || m.includes("uploadnotfound")) {
    return "This upload session expired on the server. It will restart automatically — please wait or retry.";
  }
  // OCI connectivity — DNS, socket, TLS, connection refused/reset, or a
  // fetch that never reached the origin. Tagged with the OCI_CONNECTION_FAILED
  // reason code so telemetry can group it while the user only sees the safe
  // copy. Original exception text is never surfaced to the UI.
  if (m.includes("oci_connection_failed") || m.includes("econnrefused") || m.includes("econnreset")
      || m.includes("enotfound") || m.includes("etimedout") || m.includes("dns error")
      || m.includes("connection refused") || m.includes("connection reset")
      || m.includes("connection closed") || m.includes("connection failed")) {
    return "Couldn't reach the storage service. Please check your connection and retry — the upload will resume automatically when it succeeds.";
  }
  if (m.includes("network") || m.includes("failed to fetch")) {
    return "Network interruption — the upload will resume automatically when reconnected.";
  }
  if (m.includes("oci-multipart") || m.includes("oci-upload")) {
    // Edge function returned a non-OCI error string — keep it verbatim.
    return `Upload failed — ${msg.slice(0, 240)}`;
  }
  // Truly opaque — only now do we fall back to the generic copy.
  return "Upload Failed — please try again or contact support.";
}

export async function uploadFileMultipart(p: MultipartParams, _retryAttempt = 0): Promise<MultipartResult> {
  const { file, workspaceId, pendingId, onProgress, onTelemetry, signal } = p;
  try {
    return await runMultipart(p);
  } catch (e) {
    // OCI multipart upload disappeared (expired / reclaimed / aborted out of
    // band). Clean every cached pointer and re-init from scratch ONCE with a
    // fresh pendingId so the user doesn't see UploadNotFound.
    if (e instanceof UploadSessionExpiredError && _retryAttempt === 0) {
      clearResumeEntry(file);
      const freshPendingId = `${pendingId}-r${Date.now().toString(36)}`;
      // eslint-disable-next-line no-console
      console.warn("[oci-multipart] session expired — restarting with fresh pendingId", { freshPendingId });
      return uploadFileMultipart({ ...p, pendingId: freshPendingId }, 1);
    }
    throw e;
  }
}

async function runMultipart(p: MultipartParams): Promise<MultipartResult> {
  const { file, workspaceId, pendingId, onProgress, onTelemetry, signal } = p;

  // Initial recommended chunk size — final value is clamped to server partSize after init.
  let PART_SIZE = recommendPartSize(file.size);
  let concurrency = UPLOAD_CONCURRENCY_DEFAULT;
  let totalChunks = Math.max(1, Math.ceil(file.size / PART_SIZE));

  // Telemetry / speed tracking (rolling 5s window).
  const samples: Array<{ t: number; bytes: number }> = [];
  let stage: UploadStage = "initializing";
  const emit = (loaded: number, partsDone: number) => {
    const now = performance.now();
    samples.push({ t: now, bytes: loaded });
    while (samples.length > 1 && now - samples[0].t > 5000) samples.shift();
    let speedBps = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) speedBps = Math.max(0, (last.bytes - first.bytes) / dt);
    }
    const remaining = Math.max(0, file.size - loaded);
    const etaSeconds = speedBps > 0 ? Math.round(remaining / speedBps) : null;
    onProgress?.(loaded, file.size);
    onTelemetry?.({ stage, loaded, total: file.size, partsDone, totalParts: totalChunks, speedBps, etaSeconds });
  };
  emit(0, 0);

  // 0) Hash the file for cross-device resume (skipped for >1.5GB files).
  const shaHex = await fileSha256Hex(file);

  let uploadRowId: string | null = null;
  let uploadId: string | null = null;
  let effectivePendingId = pendingId;
  let resumedFromLookup = false;
  let serverPartSize: number | null = null;

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
        partSize?: number;
      }>("lookup", { fileSha256: shaHex }, { signal });
      if (lk.found && lk.session?.oci_upload_id) {
        if (typeof lk.partSize === "number") serverPartSize = lk.partSize;
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
      partSize?: number;
      concurrency?: number;
      multipartThreshold?: number;
      maxBytes?: number;
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
      stage = "complete";
      emit(file.size, totalChunks);
      clearResumeEntry(file);
      return { upload: init.upload };
    }
    uploadRowId = init.uploadRowId;
    uploadId = init.uploadId;
    if (typeof init.partSize === "number") serverPartSize = init.partSize;
    if (typeof init.concurrency === "number" && init.concurrency > 0) concurrency = init.concurrency;
  }

  // CONTRACT VALIDATION — server partSize is the ceiling.
  if (serverPartSize && serverPartSize > 0) {
    if (PART_SIZE > serverPartSize) {
      // eslint-disable-next-line no-console
      console.warn("upload_contract_mismatch", { clientPartSize: PART_SIZE, serverPartSize });
      PART_SIZE = serverPartSize;
    }
  }
  totalChunks = Math.max(1, Math.ceil(file.size / PART_SIZE));

  saveResumeEntry(file, {
    uploadRowId: uploadRowId!,
    uploadId: uploadId!,
    pendingId: effectivePendingId,
    titleId: p.titleId ?? null,
    workspaceId,
    category: p.category ?? null,
  });

  // 3) LIST already-uploaded parts
  stage = "signing";
  emit(0, 0);
  const listed = await invoke<{ parts: Array<{ partNumber: number; etag: string }> }>(
    "list_parts", { uploadRowId, uploadId }, { signal },
  ).catch((e) => {
    // Session-expired must bubble — do NOT proceed to PUT into a dead uploadId.
    if (e instanceof UploadSessionExpiredError) throw e;
    return { parts: [] as Array<{ partNumber: number; etag: string }> };
  });
  const completed = new Map<number, string>();
  for (const part of listed.parts) completed.set(part.partNumber, part.etag);

  let loaded = Math.min(file.size, completed.size * PART_SIZE);
  stage = "uploading";
  emit(loaded, completed.size);

  // 4) Parallel chunk workers.
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
        emit(Math.min(loaded, file.size), completed.size);
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

  const workerCount = Math.min(concurrency, Math.max(1, queue.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (firstError) {
    // Session-expired must propagate so the outer wrapper can restart cleanly
    // instead of treating it as a resumable interruption.
    if (firstError instanceof UploadSessionExpiredError) throw firstError;
    const msg = firstError instanceof Error ? firstError.message : String(firstError);
    throw new ResumableUploadInterrupted(msg, firstErrorPart, totalChunks);
  }

  // 5) COMPLETE
  stage = "verifying";
  emit(loaded, completed.size);
  const parts = Array.from(completed.entries())
    .sort(([a], [b]) => a - b)
    .map(([partNumber, etag]) => ({ partNumber, etag }));
  stage = "completing";
  emit(loaded, completed.size);
  const done = await invoke<{ upload: any }>("complete", { uploadRowId, uploadId, parts }, { signal });
  stage = "complete";
  emit(file.size, totalChunks);
  clearResumeEntry(file);
  return { upload: done.upload, resumed: resumedFromLookup };
}

export async function abortMultipart(uploadRowId: string, uploadId: string): Promise<void> {
  await invoke("abort", { uploadRowId, uploadId }).catch(() => {});
}
