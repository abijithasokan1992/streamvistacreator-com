import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { getStudioWorkspaceIds, notStudio, ok, unauth, userClient } from "./_shared";

function money(paise: number | null | undefined, currency: string | null | undefined): string {
  if (paise == null) return "";
  const amount = paise / 100;
  const cur = (currency || "INR").toUpperCase();
  const symbol = cur === "INR" ? "₹" : cur === "USD" ? "$" : cur === "EUR" ? "€" : `${cur} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export default defineTool({
  name: "show_billing",
  title: "Show billing",
  description:
    "Summarize the signed-in Studio user's recent invoices, showing invoice number, amount, currency, status, and issued date.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max invoices to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const wsIds = await getStudioWorkspaceIds(ctx);
    if (wsIds.length === 0) return notStudio();
    const { data, error } = await userClient(ctx)
      .from("invoices")
      .select("id, invoice_number, description, currency, total_paise, status, issued_at, source")
      .eq("user_id", ctx.getUserId()!)
      .order("issued_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Could not load billing history." }], isError: true };
    const invoices = (data ?? []).map((r: any) => ({
      id: r.id,
      number: r.invoice_number,
      description: r.description,
      amount: money(r.total_paise, r.currency),
      currency: r.currency,
      status: r.status,
      issued_at: r.issued_at,
      source: r.source,
    }));
    const outstanding = invoices.filter((i) => i.status && i.status !== "paid" && i.status !== "refunded").length;
    return ok(
      { invoices, outstanding_count: outstanding },
      invoices.length
        ? `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}${outstanding ? `, ${outstanding} still open` : ""}.`
        : "No billing history yet.",
    );
  },
});
