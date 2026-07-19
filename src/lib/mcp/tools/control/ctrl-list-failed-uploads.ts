import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  authorize,
  ok,
  redactDeep,
  userClient,
  withTimeout,
  isSchemaMissingError,
  unavailable,
} from "../../lib/control";

/**
 * Platform-wide failed ingest_job_items view for founder / platform_owner /
 * super_admin. Unlike the existing `list_failed_uploads` tool (which is
 * RLS-scoped to the caller), this joins the parent `ingest_jobs` row so
 * admins can see failures across every workspace and project.
 *
 * Read-only. Same authorize() guard as `ctrl_list_titles` — no kill-switch
 * gate needed because writes=false.
 */
export default defineTool({
  name: "ctrl_list_failed_uploads",
  title: "List failed uploads (Control)",
  description:
    "Platform-wide list of failed ingest_job_items across all workspaces for founder audit. Optional job_id filter.",
  inputSchema: {
    job_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_list_failed_uploads", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 50), 200));
    let q = sb
      .from("ingest_job_items")
      .select(
        "id, job_id, file_name, size_bytes, status, error_message, updated_at, ingest_jobs!inner(workspace_id, project_id)",
      )
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (input.job_id) q = q.eq("job_id", input.job_id);
    const { data, error } = await withTimeout(q, "ctrl_list_failed_uploads");
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable(
          { failed_uploads: [], count: 0 },
          `ingest_job_items schema drift: ${error.message}`,
        );
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const parent = (r.ingest_jobs ?? {}) as { workspace_id?: string | null; project_id?: string | null };
      return {
        id: r.id,
        job_id: r.job_id,
        file_name: r.file_name,
        size_bytes: r.size_bytes,
        status: r.status,
        error_message: r.error_message,
        updated_at: r.updated_at,
        workspace_id: parent.workspace_id ?? null,
        project_id: parent.project_id ?? null,
      };
    });
    const redacted = redactDeep(rows);
    return ok(
      { failed_uploads: redacted, count: redacted.length },
      `Returned ${redacted.length} failed uploads platform-wide`,
    );
  },
});
