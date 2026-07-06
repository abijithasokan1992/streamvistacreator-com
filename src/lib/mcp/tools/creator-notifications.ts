import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Notifications — the caller's `notifications` rows (RLS scopes to
 * `user_id = auth.uid()`). Read-only.
 */
export default defineTool({
  name: "creator_notifications",
  title: "Notifications",
  description:
    "Recent notifications for the signed-in Creator, newest first, including whether each has been read.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max notifications (default 20)."),
    unread_only: z.boolean().optional().describe("If true, only unread notifications are returned."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, unread_only }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    let q = userClient(ctx)
      .from("notifications")
      .select("id, title, message, is_read, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (unread_only) q = q.eq("is_read", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load notifications." }], isError: true };
    const unread = (data ?? []).filter((n: any) => !n.is_read).length;
    return ok(
      { notifications: data ?? [], unread_count: unread },
      (data ?? []).length ? `${(data ?? []).length} notification${(data ?? []).length === 1 ? "" : "s"} (${unread} unread).` : "No notifications yet.",
    );
  },
});
