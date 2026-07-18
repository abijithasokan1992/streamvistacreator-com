import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, redactDeep, userClient, withTimeout, clampLimit, isSchemaMissingError, unavailable } from "../../lib/control";

export default defineTool({
  name: "list_creators",
  title: "List creators",
  description: "List creator entity profiles (public directory fields only — no contact PII).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional(),
    search: z.string().max(120).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_creators", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    let q = sb
      .from("entity_profiles")
      .select("id, display_name, kind, verification_status, created_at")
      .eq("kind", "creator")
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.search) q = q.ilike("display_name", `%${input.search}%`);
    const { data, error } = await withTimeout(q, "list_creators");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const rows = redactDeep(data ?? []);
    return ok({ creators: rows, count: rows.length }, `Returned ${rows.length} creators`);
  },
});
