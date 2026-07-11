import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

/**
 * Uses the `public.mcp_get_public_schema()` SECURITY DEFINER RPC — the caller
 * is verified inside the function via `has_mcp_control_role(auth.uid())`.
 * This tool NEVER queries information_schema through the user-JWT PostgREST
 * client (which is not exposed as an API surface anyway).
 */
export default defineTool({
  name: "get_database_schema",
  title: "Database schema (public)",
  description: "Allowlisted read-only view of tables/columns in the public schema. Founder / platform_owner / super_admin only.",
  inputSchema: { table: z.string().max(80).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_database_schema", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(sb.rpc("mcp_get_public_schema"), "schema");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const rows = (data ?? []) as Array<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>;
    const filtered = input.table ? rows.filter((r) => r.table_name === input.table) : rows;
    const byTable: Record<string, Array<Record<string, unknown>>> = {};
    for (const r of filtered) (byTable[r.table_name] ??= []).push({
      column: r.column_name, type: r.data_type, nullable: r.is_nullable === "YES",
    });
    return ok(
      { tables: Object.keys(byTable).length, schema: byTable },
      `${Object.keys(byTable).length} tables, ${filtered.length} columns${input.table ? ` (filtered by ${input.table})` : ""}`,
    );
  },
});
