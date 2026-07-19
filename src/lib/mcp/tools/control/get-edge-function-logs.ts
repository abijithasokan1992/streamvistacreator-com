import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { authorize, ok, err, redact, redactDeep, withTimeout, MAX_LOG_ROWS } from "../../lib/control";

/**
 * Read-only Supabase Management API access.
 *
 * Requires two server-side secrets — NEVER shipped to the client / model:
 *   - `SUPABASE_MANAGEMENT_ACCESS_TOKEN` (a read-scoped PAT, `sbp_...`)
 *   - `SUPABASE_PROJECT_REF`
 *
 * Hard limits:
 *   - `since` bounded by `logs_window_days` (default 7) — anything older is clamped
 *   - `limit` capped at MAX_LOG_ROWS (200) per call
 *   - 20 s network timeout, aggressive log-line redaction
 */
export default defineTool({
  name: "get_edge_function_logs",
  title: "Edge Function logs",
  description: "Recent log lines for a Lovable Cloud edge function via the Supabase Management API (read-only PAT, bounded window).",
  inputSchema: {
    function_name: z.string().min(1).max(80),
    since: z.string().datetime().optional(),
    level: z.enum(["info", "warn", "error"]).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await authorize(ctx, "get_edge_function_logs", input);
    if (denied) return denied;

    // `SUPABASE_` prefix is reserved on Lovable Cloud secrets; use MGMT_* names.
    const token =
      process.env.MGMT_ACCESS_TOKEN ??
      process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN;
    const ref =
      process.env.MGMT_PROJECT_REF ??
      process.env.SUPABASE_PROJECT_REF ??
      process.env.VITE_SUPABASE_PROJECT_ID;
    if (!token || !ref) {
      return err(
        "not_configured",
        "MGMT_ACCESS_TOKEN and MGMT_PROJECT_REF must be set (read-scoped PAT, server-side only).",
      );
    }

    const windowDays = Number(process.env.MCP_LOGS_WINDOW_DAYS ?? 7);
    const minSince = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
    const since = input.since ? new Date(input.since) : minSince;
    const effectiveSince = since < minSince ? minSince : since;
    const limit = Math.min(input.limit ?? 100, MAX_LOG_ROWS);

    const sql = `select id, timestamp, event_message, metadata
                 from function_logs
                 where function_id = '${input.function_name.replace(/'/g, "''")}'
                   and timestamp >= '${effectiveSince.toISOString()}'
                 order by timestamp desc
                 limit ${limit}`;

    const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
    try {
      const res = await withTimeout(
        fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }) as Promise<Response>,
        "mgmt_api",
      );
      if (!res.ok) {
        const body = await res.text();
        return err("mgmt_api_error", `HTTP ${res.status}: ${redact(body).slice(0, 500)}`);
      }
      const json = (await res.json()) as { result?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const rows = Array.isArray(json) ? json : json.result ?? [];
      let out = redactDeep(rows) as Array<Record<string, unknown>>;
      if (input.level) out = out.filter((r) => JSON.stringify(r).toLowerCase().includes(`"level":"${input.level}"`));
      return ok(
        { function: input.function_name, since: effectiveSince.toISOString(), count: out.length, logs: out },
        `Returned ${out.length} log rows for ${input.function_name}`,
      );
    } catch (e: any) {
      return err("mgmt_api_failed", redact(String(e?.message ?? e)));
    }
  },
});
