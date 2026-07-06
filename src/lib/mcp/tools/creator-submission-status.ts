import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Submission Status — where each of the Creator's titles sits in the review
 * pipeline. Groups by status and returns the most recently updated titles per
 * bucket. Read-only.
 */
export default defineTool({
  name: "creator_submission_status",
  title: "Submission status",
  description:
    "Show the review/approval status of the signed-in Creator's titles, grouped by stage, and list the most recently updated titles.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max recent titles to list (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const { data, error } = await userClient(ctx)
      .from("content_titles")
      .select("id, title, status, submitted_at, approved_at, published_at, updated_at")
      .eq("owner_user_id", ctx.getUserId()!)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load submission status." }], isError: true };
    const buckets: Record<string, number> = {};
    (data ?? []).forEach((t: any) => {
      const s = (t.status || "draft") as string;
      buckets[s] = (buckets[s] ?? 0) + 1;
    });
    return ok(
      { by_stage: buckets, recent: data ?? [] },
      `Reviewed ${(data ?? []).length} recent title${(data ?? []).length === 1 ? "" : "s"}.`,
    );
  },
});
