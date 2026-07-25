import { defineTool } from "@lovable.dev/mcp-js";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_team",
  title: "Show team",
  description:
    "List the signed-in Studio user's team members across their workspaces, including each member's role.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const sb = userClient(ctx);
    const { data: members, error } = await sb
      .from("workspace_members")
      .select("workspace_id, user_id, role, created_at")
      .in("workspace_id", wsIds);
    if (error) return { content: [{ type: "text", text: "Could not load team members." }], isError: true };

    const userIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
    let profiles: any[] = [];
    if (userIds.length > 0) {
      const { data: profs } = await sb
        .from("user_profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", userIds);
      profiles = profs ?? [];
    }
    const byId = new Map(profiles.map((p) => [p.user_id, p]));
    const team = (members ?? []).map((m: any) => {
      const p = byId.get(m.user_id) ?? {};
      return {
        workspace_id: m.workspace_id,
        role: m.role,
        name: (p as any).display_name ?? null,
        email: (p as any).email ?? null,
        joined_at: m.created_at,
      };
    });
    return ok(
      { team, total: team.length },
      team.length ? `Your team has ${team.length} member${team.length === 1 ? "" : "s"}.` : "No team members yet.",
    );
  },
});
