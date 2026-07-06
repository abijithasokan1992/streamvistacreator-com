import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Rights Status — availability of each right (territory, language, category)
 * for a specific title the Creator owns. Ownership is verified before the
 * rights query, so a caller can never enumerate rights on titles they don't
 * own.
 */
export default defineTool({
  name: "creator_rights_status",
  title: "Rights status",
  description:
    "Show rights availability for one of the signed-in Creator's titles: territory, language, category, exclusivity, term dates, and current status.",
  inputSchema: {
    title_id: z.string().uuid().describe("The title id to inspect."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rights rows (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ title_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const sb = userClient(ctx);
    const owner = await sb
      .from("content_titles")
      .select("id, title")
      .eq("id", title_id)
      .eq("owner_user_id", ctx.getUserId()!)
      .maybeSingle();
    if (owner.error || !owner.data) {
      return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    }
    const { data, error } = await sb
      .from("title_rights_availability")
      .select("id, right_category, territory, language, exclusivity, status, term_start, term_end, notes, updated_at")
      .eq("title_id", title_id)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: "Could not load rights availability." }], isError: true };
    return ok(
      { title: owner.data.title, rights: data ?? [] },
      (data ?? []).length
        ? `${(data ?? []).length} rights entr${(data ?? []).length === 1 ? "y" : "ies"} on "${owner.data.title}".`
        : `No rights configured yet on "${owner.data.title}".`,
    );
  },
});
