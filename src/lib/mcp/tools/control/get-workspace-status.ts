import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "get_workspace_status",
  title: "Workspace status",
  description: "High-level counts across the workspace: creators, active titles, running ingest jobs, failed emails.",
  inputSchema: { workspace_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_workspace_status", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const q = (t: string, filter?: (b: any) => any) => {
      let b = sb.from(t).select("*", { count: "exact", head: true });
      if (input.workspace_id && filter) b = filter(b);
      return withTimeout(b, `count:${t}`);
    };
    const [creators, titles, ingest, failedEmails, failedUploads] = await Promise.all([
      q("entity_profiles"),
      q("content_titles"),
      q("ingest_jobs"),
      q("email_send_log", (b) => b.eq("status", "failed")),
      q("ingest_job_items", (b) => b.eq("status", "failed")),
    ]);
    const structured = {
      workspace_id: input.workspace_id ?? null,
      counts: {
        entity_profiles: creators.count ?? 0,
        content_titles: titles.count ?? 0,
        ingest_jobs: ingest.count ?? 0,
        failed_emails: failedEmails.count ?? 0,
        failed_uploads: failedUploads.count ?? 0,
      },
    };
    return ok(structured, `Workspace status — ${JSON.stringify(structured.counts)}`);
  },
});
