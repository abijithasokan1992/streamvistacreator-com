import { defineTool } from "@lovable.dev/mcp-js";
import { authorize, err, ok, userClient, withTimeout } from "../../lib/control";
import { classifyRecoveryError, withRecovery } from "../../lib/reliability";

export default defineTool({
  name: "ctrl_connection_health",
  title: "Control connection health",
  description:
    "Verify StreamVista Control authentication and database reachability. Automatically retries transient failures and reports when user reauthorization is genuinely required.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated?.() || !ctx.getUserId()) {
      return err("reauth_required", "Reconnect StreamVista Control and approve sign-in.");
    }

    try {
      const recovered = await withRecovery(async () => {
        const denied = await authorize(ctx, "ctrl_connection_health", {}, { category: "connection_health" });
        if (denied) {
          const text = denied.content?.[0]?.text ?? "authorization_failed";
          throw new Error(text);
        }

        const sb = userClient(ctx);
        const { data, error } = await withTimeout(
          sb.from("user_roles").select("role").eq("user_id", ctx.getUserId()!).limit(10),
          "connection_health",
        );
        if (error) throw new Error(error.message);
        return data ?? [];
      });

      return ok(
        {
          connected: true,
          authenticated: true,
          database_reachable: true,
          attempts: recovered.attempts,
          recovered_automatically: recovered.attempts > 1,
          user_id: ctx.getUserId(),
          client_id: ctx.getClientId?.() ?? null,
          checked_at: new Date().toISOString(),
        },
        recovered.attempts > 1
          ? `StreamVista Control recovered automatically after ${recovered.attempts} attempts.`
          : "StreamVista Control connection is healthy.",
      );
    } catch (error) {
      const classification = classifyRecoveryError(error);
      const message = error instanceof Error ? error.message : String(error);
      if (classification === "reauth_required") {
        return err("reauth_required", "The OAuth session is expired or invalid. User approval is required once; it cannot be bypassed.");
      }
      if (classification === "forbidden") {
        return err("forbidden", "Connected account does not have StreamVista Control permission.");
      }
      if (classification === "rate_limited") {
        return err("temporarily_unavailable", "Automatic retries were exhausted because the service is rate-limited.");
      }
      return err("connection_unhealthy", message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]"));
    }
  },
});
