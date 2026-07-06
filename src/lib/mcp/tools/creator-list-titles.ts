import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Creator "List Titles" — RLS already restricts `content_titles` to
 * `owner_user_id = auth.uid()`, but we gate on the Creator role so non-creators
 * get a helpful message instead of an empty list.
 */
export default defineTool({
  name: "creator_list_titles",
  title: "List my titles",
  description:
    "List the signed-in Creator's titles with title, status, genre, language, duration, and last-updated time.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 25)."),
    status: z.string().optional().describe("Optional exact status filter (e.g. 'draft', 'submitted', 'approved')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    let q = userClient(ctx)
      .from("content_titles")
      .select("id, title, status, genre, language, duration_minutes, updated_at")
      .eq("owner_user_id", ctx.getUserId()!)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load your titles." }], isError: true };
    return ok(
      { titles: data ?? [], total: (data ?? []).length },
      (data ?? []).length ? `Showing ${data!.length} title${data!.length === 1 ? "" : "s"}.` : "No titles yet.",
    );
  },
});
