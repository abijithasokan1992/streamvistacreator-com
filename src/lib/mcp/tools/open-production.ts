import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "open_production",
  title: "Open production",
  description:
    "Open a single production and return its overview: name, banner, title number, team crew summary, active ingest jobs, and asset totals. Studio-scoped by RLS.",
  inputSchema: {
    id: z.string().uuid().describe("The production id (UUID) from `list_productions`."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient(ctx);
    const { data: p, error } = await sb
      .from("projects")
      .select("id, name, description, workspace_id, production_banner, crew, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error || !p) return { content: [{ type: "text", text: "Production not found or access denied." }], isError: true };

    const [jobs, assets] = await Promise.all([
      sb
        .from("ingest_jobs")
        .select("id, status, total_files, completed_files, transferred_bytes, total_bytes, updated_at")
        .eq("project_id", id)
        .order("updated_at", { ascending: false })
        .limit(5),
      sb.from("studio_assets").select("id, total_size_bytes", { count: "exact" }).eq("project_id", id),
    ]);

    const assetCount = assets.count ?? (assets.data?.length ?? 0);
    const totalBytes = (assets.data ?? []).reduce(
      (n: number, a: any) => n + (Number(a.total_size_bytes) || 0),
      0,
    );

    return ok(
      {
        production: {
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          banner: p.production_banner ?? p.crew?.production_house ?? null,
          title_number: p.crew?.title_number ?? null,
          crew: p.crew ?? {},
          last_updated: p.updated_at,
        },
        recent_uploads: jobs.data ?? [],
        asset_totals: { count: assetCount, total_bytes: totalBytes },
      },
      `Opened production "${p.name}".`,
    );
  },
});
