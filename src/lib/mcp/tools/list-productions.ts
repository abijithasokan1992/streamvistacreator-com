import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "list_productions",
  title: "List productions",
  description:
    "List the signed-in Studio user's active productions across their studio workspaces. Returns each production's name, title number, banner, and last-updated time.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max productions to return (default 25)."),
    search: z.string().optional().describe("Optional case-insensitive substring match on production name."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient(ctx)
      .from("projects")
      .select("id, name, description, workspace_id, production_banner, crew, updated_at, created_at")
      .in("workspace_id", wsIds)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load productions right now." }], isError: true };
    const productions = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      title_number: p.crew?.title_number ?? null,
      banner: p.production_banner ?? p.crew?.production_house ?? null,
      last_updated: p.updated_at,
    }));
    return ok(
      { productions, total: productions.length },
      productions.length
        ? `Found ${productions.length} production${productions.length === 1 ? "" : "s"}.`
        : "No productions yet in your studio workspace.",
    );
  },
});
