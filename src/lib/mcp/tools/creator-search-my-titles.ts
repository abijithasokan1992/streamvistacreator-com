import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Search My Titles — substring match on the caller's `content_titles.title`.
 * RLS restricts to `owner_user_id = auth.uid()`, and the query pins that
 * predicate as well for defence in depth.
 */
export default defineTool({
  name: "creator_search_my_titles",
  title: "Search my titles",
  description:
    "Search the signed-in Creator's titles by name (case-insensitive substring). Returns id, title, status, genre, and last-updated time.",
  inputSchema: {
    query: z.string().min(1).describe("Substring to match against title name."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const { data, error } = await userClient(ctx)
      .from("content_titles")
      .select("id, title, status, genre, language, updated_at")
      .eq("owner_user_id", ctx.getUserId()!)
      .ilike("title", `%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (error) return { content: [{ type: "text", text: "Could not search your titles." }], isError: true };
    return ok(
      { titles: data ?? [], total: (data ?? []).length, query },
      (data ?? []).length ? `${(data ?? []).length} title${(data ?? []).length === 1 ? "" : "s"} match "${query}".` : `No titles match "${query}".`,
    );
  },
});
