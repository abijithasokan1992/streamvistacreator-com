import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, userClient, withTimeout } from "../../lib/control";

export default defineTool({
  name: "ctrl_whoami",
  title: "Whoami (Control)",
  description:
    "Return the signed-in caller's user id, control-role status, and current kill-switch state. Founder / platform_owner / super_admin only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await authorize(ctx, "ctrl_whoami", {});
    if (denied) return denied;
    const sb = userClient(ctx);
    const [{ data: roles }, { data: ks }] = await Promise.all([
      withTimeout(sb.from("user_roles").select("role").eq("user_id", ctx.getUserId()!), "roles"),
      withTimeout(sb.from("mcp_control_flags").select("value").eq("key", "kill_switch").maybeSingle(), "ks"),
    ]);
    const roleList = (roles ?? []).map((r: any) => r.role);
    const structured = {
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail?.() ?? null,
      client_id: ctx.getClientId?.() ?? null,
      roles: roleList,
      is_founder: roleList.includes("founder"),
      is_platform_owner: roleList.includes("platform_owner"),
      is_super_admin: roleList.includes("super_admin"),
      kill_switch_on: Boolean(ks?.value ?? true),
      env: process.env.MCP_ENV ?? "staging",
    };
    return ok(structured, `Signed in as ${structured.email ?? structured.user_id} — roles: ${roleList.join(", ") || "(none)"}`);
  },
});
