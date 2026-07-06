import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { formatBytes, getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "search_files",
  title: "Search files",
  description:
    "Search the signed-in Studio user's media library by file title. Returns matching assets with size, camera info, and shoot date.",
  inputSchema: {
    query: z.string().min(1).describe("Substring to match against the file title (case-insensitive)."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 25)."),
    production_id: z.string().uuid().optional().describe("Optional: limit results to a specific production."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit, production_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient(ctx)
      .from("studio_assets")
      .select(
        "id, title, asset_type, total_size_bytes, file_count, camera_make, camera_model, codec, resolution, fps, shoot_date, status, project_id, workspace_id, updated_at",
      )
      .in("workspace_id", wsIds)
      .ilike("title", `%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (production_id) q = q.eq("project_id", production_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not search your media library." }], isError: true };
    const files = (data ?? []).map((a: any) => ({
      id: a.id,
      title: a.title,
      type: a.asset_type,
      size: formatBytes(a.total_size_bytes),
      file_count: a.file_count,
      camera: [a.camera_make, a.camera_model].filter(Boolean).join(" ") || null,
      codec: a.codec,
      resolution: a.resolution,
      fps: a.fps,
      shoot_date: a.shoot_date,
      status: a.status,
      production_id: a.project_id,
    }));
    return ok(
      { files, total: files.length, query },
      files.length ? `Found ${files.length} file${files.length === 1 ? "" : "s"} matching "${query}".` : `No files match "${query}".`,
    );
  },
});
