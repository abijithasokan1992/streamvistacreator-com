import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notStudio, ok, getStudioWorkspaceIds, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_recent_activity",
  title: "Show recent activity",
  description: "Show the signed-in Studio user's recent notifications and activity feed.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max entries (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient(ctx)
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load recent activity." }], isError: true };
    return ok({ activity: data ?? [] }, `Recent activity: ${(data ?? []).length} entries.`);
  },
});
