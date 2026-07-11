import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "get_today_activity",
  title: "Today's activity",
  description: "Counts of uploads, signups, payments, and errors in the last 24 hours.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "get_today_activity", {});
    if (denied) return denied;
    const sb = userClient(ctx);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const q = (t: string, col = "created_at", filter?: (b: any) => any) => {
      let b = sb.from(t).select("*", { count: "exact", head: true }).gte(col, since);
      if (filter) b = filter(b);
      return withTimeout(b, `today:${t}`);
    };
    const [uploads, ingestFail, emailFail, payments, users] = await Promise.all([
      q("ingest_job_items"),
      q("ingest_job_items", "created_at", (b) => b.eq("status", "failed")),
      q("email_send_log", "created_at", (b) => b.eq("status", "failed")),
      q("billing_orders"),
      q("user_profiles"),
    ]);
    const structured = {
      since,
      uploads_24h: uploads.count ?? 0,
      failed_uploads_24h: ingestFail.count ?? 0,
      failed_emails_24h: emailFail.count ?? 0,
      payments_24h: payments.count ?? 0,
      new_users_24h: users.count ?? 0,
    };
    return ok(structured, `Last 24h — ${JSON.stringify(structured)}`);
  },
});
