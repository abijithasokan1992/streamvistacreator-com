/**
 * Phase 1 MCP Control Server — shared helpers.
 *
 * Every Phase 1 Control tool MUST:
 *   1. Call `authorize(ctx, tool, params)` first. This:
 *        - forbids unauthenticated / non-founder callers
 *        - enforces the kill-switch for writes (Phase 1 tools pass writes=false)
 *        - enforces the per-user-per-minute rate limit
 *        - inserts an audit row (allowed=true or false with reason)
 *      Returns an "isError" tool response on any failure — the handler should return it.
 *   2. Use the caller's JWT-scoped Supabase client (RLS-enforced) for reads. This
 *      module NEVER instantiates a service-role client. Phase 1 has zero write paths.
 *   3. Redact secrets/PII from any string it returns.
 *
 * IMPORTANT (per Phase 1 approval):
 *   - No SUPABASE_SERVICE_ROLE_KEY usage anywhere in this file or its callers.
 *   - `get_database_schema` and `get_security_advisors` use SECURITY DEFINER RPCs
 *     that themselves check `has_mcp_control_role(auth.uid())` and expose only
 *     an allowlisted read-only projection.
 *   - `get_edge_function_logs` uses a Supabase Management API read-only PAT
 *     (`SUPABASE_MANAGEMENT_ACCESS_TOKEN`) with a bounded time window and
 *     per-call row cap; the PAT is never returned to the caller.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

const TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT_MS ?? 20_000);
const MAX_LIMIT = 100;
const MAX_LOG_ROWS = 200;

export const clampLimit = (n: number | undefined, max = MAX_LIMIT) =>
  Math.max(1, Math.min(Math.floor(n ?? 25), max));

/** Per-request Supabase client bound to the caller's JWT — RLS enforced. */
export function userClient(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("supabase_env_missing");
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Bounded fetch wrapper with a hard timeout. Accepts thenables (PostgREST builders). */
export async function withTimeout<T>(p: PromiseLike<T>, label = "op"): Promise<T> {
  return await Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout:${label}`)), TIMEOUT_MS),
    ),
  ]);
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export const err = (code: string, msg?: string): ToolResult => ({
  content: [{ type: "text", text: msg ? `${code}: ${msg}` : code }],
  isError: true,
});

export const ok = (structured: Record<string, unknown>, summary: string): ToolResult => ({
  content: [{ type: "text", text: summary }],
  structuredContent: structured,
});

/**
 * Detect PostgREST/Postgres errors that indicate a query referenced a
 * column/relation that does not exist in the current schema (typically because
 * a legacy field was renamed or dropped). Callers should treat these as
 * "unavailable" instead of a hard error so the assistant returns a structured
 * empty result rather than a 500-style crash.
 */
export function isSchemaMissingError(e: { message?: string; code?: string } | null | undefined): boolean {
  if (!e) return false;
  const msg = String(e.message ?? "").toLowerCase();
  const code = String(e.code ?? "");
  return (
    code === "42703" ||
    code === "42P01" ||
    /column .* does not exist/.test(msg) ||
    /relation .* does not exist/.test(msg) ||
    /could not find the .* column/.test(msg)
  );
}

/** Structured "unavailable" reply — HTTP 200, empty rows, explicit reason. */
export function unavailable(structured: Record<string, unknown>, reason: string): ToolResult {
  return {
    content: [{ type: "text", text: `unavailable: ${reason}` }],
    structuredContent: { ...structured, unavailable: true, reason },
  };
}

/**
 * Redact obvious secrets and PII from strings before returning them.
 * Aggressive by design: MCP responses reach ChatGPT which reaches humans.
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]"],
  [/sbp_[A-Za-z0-9]{20,}/g, "[REDACTED_SUPABASE_PAT]"],
  [/sk_(?:live|test)_[A-Za-z0-9]{20,}/g, "[REDACTED_STRIPE_KEY]"],
  [/rzp_(?:live|test)_[A-Za-z0-9]{10,}/g, "[REDACTED_RAZORPAY_KEY]"],
  [/ghp_[A-Za-z0-9]{30,}/g, "[REDACTED_GITHUB_PAT]"],
  [/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GOOGLE_KEY]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED_PAN]"],
];
export function redact(s: string): string {
  let out = s;
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}
export function redactDeep<T>(v: T): T {
  if (v == null) return v;
  if (typeof v === "string") return redact(v) as unknown as T;
  if (Array.isArray(v)) return v.map(redactDeep) as unknown as T;
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, vv] of Object.entries(v as Record<string, unknown>)) out[k] = redactDeep(vv);
    return out as unknown as T;
  }
  return v;
}

/**
 * Authorize + audit + rate-limit in one round-trip via SECURITY DEFINER RPC.
 * Returns `null` on success. Returns a ready-to-return tool error otherwise.
 * `writes` is always false in Phase 1.
 *
 * Phase C: also emits a client-side envelope with correlation_id + duration_ms
 * so downstream audit rendering can group multi-step requests. Envelope is
 * appended to the `details` blob of the audit row the RPC inserts by echoing
 * the same fields back to the caller in a wrapper — kept backward compatible
 * because the RPC continues to run unchanged.
 */
export async function authorize(
  ctx: ToolContext,
  tool: string,
  params: Record<string, unknown> = {},
  opts: { writes?: boolean; correlationId?: string; category?: string } = {},
): Promise<ToolResult | null> {
  if (!ctx.isAuthenticated?.() || !ctx.getUserId()) {
    return err("unauthenticated", "Sign in to StreamVista as a founder / platform_owner / super_admin.");
  }

  let data: unknown;
  try {
    const sb = userClient(ctx);
    const safeParams = redactDeep(params);
    const correlationId = opts.correlationId ?? cryptoRandomId();
    const startedAt = Date.now();
    const response = await withTimeout(
      sb.rpc("mcp_authorize_and_log", {
        _tool: tool,
        _params: {
          ...(safeParams as Record<string, unknown>),
          _envelope: {
            correlation_id: correlationId,
            started_at: new Date(startedAt).toISOString(),
            category: opts.category ?? (opts.writes ? "db_write" : "db_read"),
            writes: !!opts.writes,
            client_id: (ctx.getClientId?.() ?? null) as string | null,
          },
        } as unknown as Record<string, unknown>,
        _writes: opts.writes ?? false,
      }),
      `authorize:${tool}`,
    );
    if (response.error) return err("authorize_failed", redact(response.error.message));
    data = response.data;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return err("authorize_exception", redact(message));
  }

  const decision = String(data ?? "");
  if (decision === "ok") return null;
  if (decision === "forbidden")
    return err("forbidden", "This tool is restricted to founder, platform_owner, and super_admin.");
  if (decision === "kill_switch")
    return err("writes_disabled", "The production write kill switch is on.");
  if (decision === "rate_limited")
    return err("rate_limited", "Rate limit exceeded — retry in a minute.");
  return err("authorize_unknown", decision);
}

/** Random correlation id — server-side, framework-free. */
function cryptoRandomId(): string {
  try {
    const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch { /* ignore */ }
  return "cor-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export { MAX_LIMIT, MAX_LOG_ROWS };
