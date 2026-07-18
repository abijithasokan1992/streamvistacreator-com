import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, redactDeep, userClient, withTimeout, clampLimit, isSchemaMissingError, unavailable } from "../../lib/control";

export default defineTool({
  name: "list_failed_uploads",
  title: "List failed uploads",
  description: "Failed ingest job items with error reasons (redacted).",
  inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_failed_uploads", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(
      sb
        .from("ingest_job_items")
        .select("id, job_id, file_name, mime_guess, size_bytes, error_message, metadata, created_at, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(clampLimit(input.limit)),
      "list_failed_uploads",
    );
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ failed_uploads: [], count: 0 }, `ingest_job_items schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok({ failed_uploads: rows, count: rows.length }, `Returned ${rows.length} failed uploads`);
  },
});
