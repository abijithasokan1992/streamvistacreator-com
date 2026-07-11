import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout, clampLimit } from "../../lib/control";

export default defineTool({
  name: "ctrl_list_titles",
  title: "List titles (Control)",
  description: "List content titles across the platform for founder audit. Optional status filter.",
  inputSchema: {
    status: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "ctrl_list_titles", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    let q = sb
      .from("content_titles")
      .select("id, title, status, owner_user_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await withTimeout(q, "ctrl_list_titles");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok({ titles: data ?? [], count: (data ?? []).length }, `Returned ${(data ?? []).length} titles`);
  },
});
