import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Review Notes — mirrors the on-app "Review Notes" inbox (see
 * `ReviewNotesInbox.tsx`). Pulls the caller's title ids, then approval notes
 * attached to them. Read-only.
 */
export default defineTool({
  name: "creator_review_notes",
  title: "Review notes",
  description:
    "Latest review notes posted by the review team on the signed-in Creator's titles. Includes the review decision and the note text.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max notes (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const sb = userClient(ctx);
    const titles = await sb
      .from("content_titles")
      .select("id, title")
      .eq("owner_user_id", ctx.getUserId()!);
    if (titles.error) return { content: [{ type: "text", text: "Could not load your titles." }], isError: true };
    const titleIds = (titles.data ?? []).map((t: any) => t.id);
    if (titleIds.length === 0) return ok({ notes: [] }, "No review notes yet.");
    const titleMap = new Map((titles.data ?? []).map((t: any) => [t.id, t.title as string]));
    const { data, error } = await sb
      .from("content_approvals")
      .select("id, title_id, to_status, note, created_at")
      .in("title_id", titleIds)
      .not("note", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load review notes." }], isError: true };
    const notes = (data ?? []).map((r: any) => ({
      id: r.id,
      title_id: r.title_id,
      title: titleMap.get(r.title_id) ?? "Untitled",
      decision: r.to_status,
      note: r.note,
      posted_at: r.created_at,
    }));
    return ok(
      { notes },
      notes.length ? `${notes.length} review note${notes.length === 1 ? "" : "s"} from the review team.` : "No review notes yet.",
    );
  },
});
