import { defineTool } from "@lovable.dev/mcp-js";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "get_security_advisors",
  title: "Security advisors (DB snapshot)",
  description: "DB-side security snapshot: which public tables have RLS enabled. Founder / platform_owner / super_admin only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "get_security_advisors", {});
    if (denied) return denied;
    const sb = userClient(ctx);
    const { data, error } = await withTimeout(sb.rpc("mcp_get_security_advisors"), "advisors");
    if (error) return { content: [{ type: "text", text: `db_error: ${error.message}` }], isError: true };
    return ok({ advisors: data ?? {} }, "Security advisors — DB snapshot");
  },
});
