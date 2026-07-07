/**
 * Cross-surface upload failure utilities.
 *
 * Mirror of `src/lib/payments/billingFailure.ts` but scoped to OCI upload
 * paths. Goal: stop swallowing real OCI / multipart errors behind a generic
 * "Upload Failed" toast, and route real server-side failures into the same
 * `support_requests` admin inbox that billing failures use.
 *
 * Reuses existing infra — no new tables, no new edge functions.
 */
import { supabase } from "@/integrations/supabase/client";
import { classifyUploadError, type UploadDiagnostic } from "./classifyUploadError";

export type UploadStage =
  | "validation"        // client-side guard before we ever hit the network
  | "upload_init"       // calling oci-upload / oci-multipart init
  | "multipart_create"  // server failed to create the OCI multipart session
  | "part_upload"       // a part PUT to OCI failed after retries
  | "multipart_commit"  // OCI complete-multipart failed
  | "upload_finalize"   // recent_uploads / title_assets DB write failed
  | "session_expired";  // OCI upload id was reclaimed / aborted

export type UploadSurface =
  | "studio_c2c_ingest"
  | "creator_title_asset"
  | "creator_master_archive"
  | "ingest_test_harness"
  | string;

export interface UploadFailureContext {
  userId?: string | null;
  userEmail?: string | null;
  surface: UploadSurface;
  stage: UploadStage;
  fileName?: string;
  fileSize?: number;
  workspaceId?: string | null;
  titleId?: string | null;
  category?: string | null;
  uploadRowId?: string | null;
  ociUploadId?: string | null;
  error: unknown;
  extra?: Record<string, unknown>;
}

/**
 * Extract a usable error message from any of:
 *  - a thrown Error
 *  - an edge-function FunctionsHttpError (with a Response in .context)
 *  - a raw fetch Response that came back non-2xx
 *  - a plain JSON object { error } / { message }
 *
 * Never returns the generic "Edge Function returned a non-2xx status code"
 * SDK string — falls back to `fallback` instead.
 */
export async function extractUploadError(err: unknown, fallback: string): Promise<string> {
  if (!err) return fallback;
  const a = err as any;
  try {
    const ctx = a?.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.json().catch(() => null);
      if (body) {
        if (typeof body.error === "string") return body.error;
        if (typeof body.message === "string") return body.message;
      }
    }
    if (ctx && typeof ctx.text === "function") {
      const txt = await ctx.text().catch(() => "");
      if (txt && txt.length < 500) return txt;
    }
  } catch { /* swallow */ }
  if (a instanceof Response) {
    try {
      const t = await a.text();
      if (t) return t.slice(0, 500);
    } catch { /* swallow */ }
  }
  if (typeof a?.message === "string" && !/non-2xx/i.test(a.message)) {
    return a.message;
  }
  if (typeof a === "string") return a;
  return fallback;
}

/**
 * Heuristic: should this stage / message be reported to the admin inbox?
 *
 * We DO NOT log:
 *   - pure client-side validation rejections (file type, size, quota)
 *   - aborted-by-user
 *   - the user simply not being signed in
 *
 * We DO log:
 *   - any OCI error (auth, signing, 4xx/5xx from object storage)
 *   - multipart create / commit failures
 *   - session-expired events
 *   - any upload_finalize failure (DB write inconsistency)
 */
function shouldReport(stage: UploadStage, message: string): boolean {
  const m = (message || "").toLowerCase();
  if (stage === "validation") return false;
  if (m.includes("aborted") || m.includes("user cancelled")) return false;
  if (m.includes("not signed in") || m.includes("please sign in")) return false;
  if (m.includes("storage_quota") || m.includes("storage quota")) return false;
  if (m.includes("exceeds category limit") || m.includes("forbidden_file_type") || m.includes("forbidden_workspace")) {
    // forbidden_workspace IS worth logging (potential probe), but pure
    // category / file-type rejections are user-facing UX, not admin issues.
    return m.includes("forbidden_workspace");
  }
  return true;
}

/**
 * Best-effort write into `support_requests` so admins see real upload
 * failures alongside billing failures. Never throws.
 */
export async function reportUploadFailure(ctx: UploadFailureContext): Promise<void> {
  try {
    const message = ctx.error instanceof Error ? ctx.error.message : String(ctx.error ?? "");
    if (!shouldReport(ctx.stage, message)) return;

    const metadata = {
      kind: "upload_failure",
      surface: ctx.surface,
      upload_stage: ctx.stage,
      file_name: ctx.fileName,
      file_size: ctx.fileSize,
      workspace_id: ctx.workspaceId,
      title_id: ctx.titleId,
      category: ctx.category,
      upload_row_id: ctx.uploadRowId,
      oci_upload_id: ctx.ociUploadId,
      error_message: message,
      error_at: new Date().toISOString(),
      ...(ctx.extra ?? {}),
    };

    await (supabase as any).from("support_requests").insert({
      user_id: ctx.userId ?? null,
      request_type: "upload_failure",
      subject: `Upload failure · ${ctx.surface} · ${ctx.stage} · ${ctx.fileName ?? "(unnamed)"}`,
      message:
        `An upload failed and was logged automatically.\n\n` +
        `Surface: ${ctx.surface}\n` +
        `Stage: ${ctx.stage}\n` +
        `File: ${ctx.fileName ?? "—"} (${ctx.fileSize ?? "?"} bytes)\n` +
        `Workspace: ${ctx.workspaceId ?? "—"}\n` +
        `Title / Category: ${ctx.titleId ?? "—"} / ${ctx.category ?? "—"}\n` +
        `OCI upload id: ${ctx.ociUploadId ?? "—"}\n` +
        `User: ${ctx.userEmail ?? ctx.userId ?? "—"}\n\n` +
        `Error:\n${message || "(no message)"}\n`,
      status: "open",
      metadata,
    });
  } catch {
    /* never block the user on logging */
  }
}
