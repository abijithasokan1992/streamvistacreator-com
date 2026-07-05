/**
 * Ingest INSERT failure audit
 * ============================
 * Records rejected ingest_jobs INSERT attempts so admins can investigate
 * permission problems even though the main row never persisted.
 *
 * The audit table has its own permissive INSERT policy scoped to
 * `user_id = auth.uid()` — the same session that just failed to write to
 * `ingest_jobs` can still write its own failure record.
 */
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

export type IngestFailureCategory =
  | "rls_denied"
  | "session_expired"
  | "check_constraint"
  | "foreign_key"
  | "unknown";

export type IngestFailureContext = {
  userId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  reason: string;
  errorCode?: string | null;
  category: IngestFailureCategory;
  sourceSummary?: Record<string, unknown>;
};

export function categorizeIngestError(
  error: PostgrestError | Error | null | undefined,
): { category: IngestFailureCategory; code: string | null; reason: string } {
  if (!error) return { category: "unknown", code: null, reason: "Unknown error" };
  const anyErr = error as PostgrestError & { status?: number };
  const code = anyErr.code ?? null;
  const msg = (anyErr.message ?? String(error) ?? "").toLowerCase();

  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return { category: "rls_denied", code, reason: anyErr.message ?? "Row-level security denied insert" };
  }
  if (code === "PGRST301" || msg.includes("jwt expired") || msg.includes("invalid jwt") || msg.includes("not authenticated")) {
    return { category: "session_expired", code, reason: anyErr.message ?? "Session expired" };
  }
  if (code === "23514" || msg.includes("check constraint")) {
    return { category: "check_constraint", code, reason: anyErr.message ?? "Check constraint violation" };
  }
  if (code === "23503" || msg.includes("foreign key")) {
    return { category: "foreign_key", code, reason: anyErr.message ?? "Foreign key violation" };
  }
  return { category: "unknown", code, reason: anyErr.message ?? "Unknown error" };
}

export async function logIngestInsertFailure(ctx: IngestFailureContext): Promise<void> {
  if (!ctx.userId) return; // cannot audit without a signed-in user id
  try {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : null;
    await supabase.from("ingest_job_insert_failures").insert({
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId,
      project_id: ctx.projectId,
      reason: ctx.reason.slice(0, 2000),
      error_code: ctx.errorCode ?? ctx.category,
      source_summary: (ctx.sourceSummary ?? {}) as Record<string, unknown>,
      user_agent: ua,
    });
  } catch {
    // Never let audit logging block the caller.
  }
}

/**
 * Turn a categorized error into a user-facing message + suggested next steps.
 */
export function ingestFailureUserMessage(
  category: IngestFailureCategory,
): { title: string; description: string; nextSteps: string[] } {
  switch (category) {
    case "rls_denied":
      return {
        title: "Upload blocked by workspace permissions",
        description:
          "Your account isn't allowed to create ingest jobs in this workspace. This usually means you were removed from the workspace or your session is stale.",
        nextSteps: [
          "Sign out and sign back in to refresh your session token.",
          "Ask a workspace admin to confirm you're still a member.",
          "If the problem persists, contact support with the failure ID from the queue.",
        ],
      };
    case "session_expired":
      return {
        title: "Your session has expired",
        description: "Sign out and sign back in, then retry the import.",
        nextSteps: ["Sign out.", "Sign back in.", "Retry the import from the ingest queue."],
      };
    case "check_constraint":
      return {
        title: "Ingest job values were rejected by the database",
        description: "A field in the job payload didn't match the allowed values. This is usually a client bug; please retry, and report it if it repeats.",
        nextSteps: ["Retry the import.", "If the error repeats, contact support and share the reason string below."],
      };
    case "foreign_key":
      return {
        title: "Production or workspace no longer exists",
        description: "The production you selected was deleted or moved to another workspace.",
        nextSteps: ["Pick a different production.", "Reload the page to refresh the production list."],
      };
    default:
      return {
        title: "Could not start the import",
        description: "Something went wrong preparing the ingest job. Retry, and contact support if it keeps failing.",
        nextSteps: ["Retry the import.", "Contact support if the failure repeats."],
      };
  }
}
