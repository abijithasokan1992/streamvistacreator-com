import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout, clampLimit } from "../../lib/control";

export default defineTool({
  name: "list_invoices",
  title: "List invoices",
  description: "Invoice summary rows for founder audit.",
  inputSchema: {
    since: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_invoices", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    let q = sb
      .from("invoices")
      .select("id, invoice_number, status, total_amount, currency, issue_date, due_date, created_at")
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.since) q = q.gte("created_at", input.since);
    const { data, error } = await withTimeout(q, "list_invoices");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok({ invoices: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} invoices`);
  },
});
