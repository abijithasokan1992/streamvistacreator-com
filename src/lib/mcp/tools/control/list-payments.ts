import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout, clampLimit } from "../../lib/control";

export default defineTool({
  name: "list_payments",
  title: "List payments",
  description: "Billing orders / payments summary (no PAN, no card data, no UPI IDs).",
  inputSchema: {
    since: z.string().datetime().optional(),
    status: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_payments", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    let q = sb
      .from("billing_orders")
      .select("id, status, amount, currency, product_code, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.since) q = q.gte("created_at", input.since);
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await withTimeout(q, "list_payments");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok({ payments: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} payments`);
  },
});
