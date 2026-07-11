import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout, clampLimit } from "../../lib/control";

export default defineTool({
  name: "list_uploads",
  title: "List uploads",
  description: "Recent ingest job items with optional status filter.",
  inputSchema: {
    status: z.enum(["queued", "processing", "succeeded", "failed"]).optional(),
    since: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "list_uploads", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    let q = sb
      .from("ingest_job_items")
      .select("id, job_id, status, filename, mime_type, size_bytes, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.status) q = q.eq("status", input.status);
    if (input.since) q = q.gte("created_at", input.since);
    const { data, error } = await withTimeout(q, "list_uploads");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok({ uploads: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} uploads`);
  },
});
