import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

export default defineTool({
  name: "show_deliveries",
  title: "Show deliveries",
  description:
    "List the signed-in Studio user's recent buyer deliveries, including recipient, delivery status, and share expiry.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max deliveries to return (default 20)."),
    status: z.string().optional().describe("Optional exact status filter (e.g. 'pending', 'shared', 'delivered')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    let q = userClient(ctx)
      .from("deal_deliveries")
      .select(
        "id, status, method, buyer_org_name, recipient_email, share_url, expires_at, shared_at, delivered_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: "Could not load deliveries." }], isError: true };
    return ok(
      { deliveries: data ?? [] },
      (data ?? []).length ? `Showing ${data!.length} deliver${data!.length === 1 ? "y" : "ies"}.` : "No deliveries yet.",
    );
  },
});
