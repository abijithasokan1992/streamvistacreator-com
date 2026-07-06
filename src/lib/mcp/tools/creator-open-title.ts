import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Creator "Open Title" — returns friendly details for one title the caller
 * owns. RLS ensures the row is only visible to its owner; the tool also gates
 * on the Creator role so non-creators get a friendly message.
 */
export default defineTool({
  name: "creator_open_title",
  title: "Open a title",
  description:
    "Open one of the signed-in Creator's titles by id and return its core details, current status, and last-updated time.",
  inputSchema: { id: z.string().uuid().describe("The title id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const { data, error } = await userClient(ctx)
      .from("content_titles")
      .select(
        "id, title, status, genre, language, duration_minutes, synopsis, tags, updated_at, created_at",
      )
      .eq("id", id)
      .eq("owner_user_id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: "Could not open that title." }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Title not found in your workspace." }], isError: true };
    return ok({ title: data }, `${data.title} — status: ${data.status ?? "draft"}.`);
  },
});
