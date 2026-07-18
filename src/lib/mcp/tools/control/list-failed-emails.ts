import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, redactDeep, userClient, withTimeout, clampLimit, isSchemaMissingError, unavailable } from "../../lib/control";

export default defineTool({
  name: "list_failed_emails",
  title: "List failed emails",
  description: "Failed rows from email_send_log with redacted error reasons.",
  inputSchema: { limit: z.number().int().min(1).max(100).optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_failed_emails", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(
      sb
        .from("email_send_log")
        .select("id, message_id, template_name, status, error_message, created_at")
        .in("status", ["failed", "failed_permanent", "dlq", "bounced"])
        .order("created_at", { ascending: false })
        .limit(clampLimit(input.limit)),
      "list_failed_emails",
    );
    if (error) {
      if (isSchemaMissingError(error)) {
        return unavailable({ failed_emails: [], count: 0 }, `email_send_log schema drift: ${error.message}`);
      }
      return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    }
    const rows = redactDeep(data ?? []);
    return ok({ failed_emails: rows, count: rows.length }, `Returned ${rows.length} failed emails`);
  },
});
