import { defineTool } from "@lovable.dev/mcp-js";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Creator "My Workspace" — high-level overview of the signed-in Creator's
 * portfolio: how many titles they have, how many are in each review stage,
 * and how many active distribution offers they hold. All data comes from the
 * same tables the Creator dashboard queries, under RLS.
 */
export default defineTool({
  name: "creator_my_workspace",
  title: "My workspace",
  description:
    "Overview of the signed-in Creator's workspace: total titles, titles by review stage, and active distribution offers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    const uid = ctx.getUserId()!;
    const sb = userClient(ctx);
    const [titles, offers] = await Promise.all([
      sb.from("content_titles").select("id, status").eq("owner_user_id", uid),
      sb
        .from("distribution_program_offers")
        .select("id, status")
        .eq("creator_user_id", uid),
    ]);
    if (titles.error || offers.error) {
      return { content: [{ type: "text", text: "Could not load your workspace summary." }], isError: true };
    }
    const byStatus: Record<string, number> = {};
    (titles.data ?? []).forEach((t: any) => {
      const s = (t.status || "draft") as string;
      byStatus[s] = (byStatus[s] ?? 0) + 1;
    });
    const activeOffers = (offers.data ?? []).filter(
      (o: any) => o.status && o.status !== "rejected" && o.status !== "expired",
    ).length;
    return ok(
      {
        total_titles: (titles.data ?? []).length,
        titles_by_status: byStatus,
        active_distribution_offers: activeOffers,
      },
      `You have ${(titles.data ?? []).length} title${(titles.data ?? []).length === 1 ? "" : "s"} and ${activeOffers} active distribution offer${activeOffers === 1 ? "" : "s"}.`,
    );
  },
});
