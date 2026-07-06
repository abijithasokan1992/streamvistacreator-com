import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { formatBytes, getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_upload_progress",
  title: "Show upload progress",
  description:
    "Show current and recent media uploads for the signed-in Studio user, with human-readable progress and transfer size.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max uploads to return (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient(ctx)
      .from("ingest_jobs")
      .select(
        "id, status, total_files, completed_files, failed_files, total_bytes, transferred_bytes, started_at, completed_at, updated_at, project_id",
      )
      .in("workspace_id", wsIds)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: "Could not load upload progress." }], isError: true };
    const uploads = (data ?? []).map((j: any) => {
      const pct =
        j.total_files && j.total_files > 0
          ? Math.round((100 * (j.completed_files ?? 0)) / j.total_files)
          : 0;
      return {
        id: j.id,
        status: j.status,
        files_completed: j.completed_files ?? 0,
        files_total: j.total_files ?? 0,
        files_failed: j.failed_files ?? 0,
        percent_complete: pct,
        transferred: formatBytes(j.transferred_bytes),
        total_size: formatBytes(j.total_bytes),
        started_at: j.started_at,
        completed_at: j.completed_at,
      };
    });
    return ok(
      { uploads },
      uploads.length ? `Showing ${uploads.length} upload${uploads.length === 1 ? "" : "s"}.` : "No uploads yet.",
    );
  },
});
