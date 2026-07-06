import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isCreatorUser, notCreator, ok, unauth, userClient } from "./_shared";

/**
 * Distribution Status — mirrors the on-app `CreatorDistributionOffers` view,
 * which reads from `distribution_program_offers` scoped to
 * `creator_user_id = auth.uid()`. Read-only.
 */
export default defineTool({
  name: "creator_distribution_status",
  title: "Distribution status",
  description:
    "List distribution program offers held by the signed-in Creator, showing program name, term, revenue split, and current status.",
  inputSchema: {
    status: z.string().optional().describe("Optional exact status filter (e.g. 'offered', 'accepted', 'rejected')."),
    limit: z.number().int().min(1).max(100).optional().describe("Max offers (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    if (!(await isCreatorUser(ctx))) return notCreator();
    let q = userClient(ctx)
      .from("distribution_program_offers")
      .select(
        "id, program_name, status, revenue_model, rights_holder_share_pct, streamvista_share_pct, term_years, term_start_date, term_end_date, is_non_exclusive, offered_at, accepted_at, rejected_at, title_id, updated_at",
      )
      .eq("creator_user_id", ctx.getUserId()!)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load distribution offers." }], isError: true };
    return ok(
      { offers: data ?? [] },
      (data ?? []).length ? `Showing ${data!.length} distribution offer${data!.length === 1 ? "" : "s"}.` : "No distribution offers yet.",
    );
  },
});
