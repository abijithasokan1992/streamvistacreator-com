import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, err, redactDeep, userClient, withTimeout, clampLimit } from "../../lib/control";

/**
 * Structured search over an allowlist of tables. NO raw SQL. Filters are
 * translated to typed PostgREST builder calls with fixed operator set.
 */
const TABLE_ALLOWLIST: Record<string, { columns: string[]; textCol?: string }> = {
  content_titles: { columns: ["id", "title", "status", "created_at", "updated_at"], textCol: "title" },
  entity_profiles: { columns: ["id", "slug", "display_name", "kind", "status", "created_at"], textCol: "display_name" },
  ingest_jobs: { columns: ["id", "status", "source", "created_at", "updated_at"] },
  billing_orders: { columns: ["id", "status", "amount", "currency", "product_code", "created_at"] },
  invoices: { columns: ["id", "invoice_number", "status", "total_amount", "currency", "issue_date", "created_at"] },
};

const OP = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "ilike"]);

export default defineTool({
  name: "search_workspace_records",
  title: "Search workspace records",
  description: "Typed, parameterized search across an allowlisted set of tables. Never runs raw SQL.",
  inputSchema: {
    table: z.string(),
    filters: z
      .array(z.object({ column: z.string(), op: OP, value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }))
      .max(6)
      .optional(),
    text: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "search_workspace_records", input);
    if (denied) return denied;
    const spec = TABLE_ALLOWLIST[input.table];
    if (!spec) return err("table_not_allowlisted", `Allowed: ${Object.keys(TABLE_ALLOWLIST).join(", ")}`);
    const sb = userClient(ctx);
    let q: any = sb.from(input.table).select(spec.columns.join(",")).limit(clampLimit(input.limit, 50));
    for (const f of input.filters ?? []) {
      if (!spec.columns.includes(f.column)) return err("column_not_allowlisted", f.column);
      q = q[f.op](f.column, f.value);
    }
    if (input.text && spec.textCol) q = q.ilike(spec.textCol, `%${input.text}%`);
    const { data, error } = await withTimeout(q, `search:${input.table}`);
    if (error) return err("db_error", error.message);
    const rows = redactDeep(data ?? []);
    return ok({ table: input.table, rows, count: rows.length }, `Returned ${rows.length} rows from ${input.table}`);
  },
});
