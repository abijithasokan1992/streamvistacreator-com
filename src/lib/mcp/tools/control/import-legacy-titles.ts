import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

const RecordSchema = z.object({
  legacy_ref: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  synopsis: z.string().max(20_000).optional(),
  language: z.string().max(80).optional(),
  genre: z.string().max(120).optional(),
  duration_minutes: z.number().int().min(0).max(100_000).optional(),
  owner_user_id: z.string().uuid(),
});

export default defineTool({
  name: "ctrl_import_legacy_titles",
  title: "Import legacy titles (Control)",
  description:
    "Idempotent import of legacy films into content_titles. Upserts on legacy_ref: existing rows are updated, new rows insert as status='draft'. Never auto-submits/approves/publishes. Max 50 records per call. Respects the MCP kill switch. Writes one audit row per insert/update.",
  inputSchema: {
    records: z.array(RecordSchema).min(1).max(50),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_import_legacy_titles", { count: input.records.length }, { writes: true });
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(
      sb.rpc("mcp_import_legacy_titles", { _records: input.records as unknown as never }),
      "ctrl_import_legacy_titles",
    );
    if (error)
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    const result = (data ?? {}) as { inserted?: string[]; updated?: string[]; skipped_invalid?: unknown[] };
    const inserted = result.inserted ?? [];
    const updated = result.updated ?? [];
    const skipped = result.skipped_invalid ?? [];
    return ok(
      { inserted, updated, skipped_invalid: skipped },
      `Inserted ${inserted.length}, updated ${updated.length}, skipped ${skipped.length}.`,
    );
  },
});
