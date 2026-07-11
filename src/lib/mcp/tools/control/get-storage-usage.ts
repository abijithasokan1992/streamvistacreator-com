import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout, clampLimit } from "../../lib/control";

export default defineTool({
  name: "get_storage_usage",
  title: "Storage usage",
  description: "Workspace storage allocation vs usage.",
  inputSchema: {
    workspace_id: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_storage_usage", input);
    if (denied) return denied;
    const sb = userClient(ctx);
    const [ent, use] = await Promise.all([
      withTimeout(
        (input.workspace_id
          ? sb.from("workspace_storage_entitlements").select("*").eq("workspace_id", input.workspace_id)
          : sb.from("workspace_storage_entitlements").select("*").limit(clampLimit(input.limit))
        ),
        "entitlements",
      ),
      withTimeout(
        (input.workspace_id
          ? sb.from("workspace_storage_usage").select("*").eq("workspace_id", input.workspace_id)
          : sb.from("workspace_storage_usage").select("*").limit(clampLimit(input.limit))
        ),
        "usage",
      ),
    ]);
    return ok(
      { entitlements: ent.data ?? [], usage: use.data ?? [] },
      `Storage entitlements: ${(ent.data ?? []).length}, usage rows: ${(use.data ?? []).length}`,
    );
  },
});
