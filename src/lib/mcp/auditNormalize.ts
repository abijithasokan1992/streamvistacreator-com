/**
 * Phase C · MCP audit-row contract.
 *
 * Normalizes a raw `mcp_audit_log` row (from either the SECURITY DEFINER
 * `mcp_authorize_and_log` insert on the edge server or the client-side
 * `runGoverned` insert) into a single UI-safe shape.
 *
 * Backward compatible: many legacy rows have only
 *   { action, resource, permission_key, allowed, actor_email, created_at }.
 * Everything else lives in the `details` JSONB blob. When a field is missing
 * we emit the literal string "Unknown/not recorded" — never an ambiguous "—"
 * — so operators can tell "we don't know" apart from "we know it's empty".
 *
 * All timestamps are preserved as ISO strings (timezone-aware) plus a
 * pre-formatted local render. Errors are passed through the same secret
 * redactor as everything else the agent surface returns.
 */

export const UNKNOWN = "Unknown/not recorded" as const;

/** Raw shape as read from Supabase — kept loose to tolerate legacy rows. */
export type RawAuditRow = {
  id: string;
  created_at: string;
  action: string;
  resource: string | null;
  permission_key: string | null;
  allowed: boolean;
  actor_email: string | null;
  actor_user_id?: string | null;
  details?: Record<string, unknown> | null;
};

export type Decision = "allowed" | "denied" | "error";
export type Category =
  | "db_read"
  | "db_write"
  | "storage_read"
  | "storage_write"
  | "edge_invoke"
  | "user_data_export"
  | "control"
  | "oauth"
  | "unknown";

export type NormalizedAudit = {
  id: string;
  timestampIso: string;                    // always ISO w/ TZ
  timestampLabel: string;                  // localized render for lists
  actorEmail: string;                      // never blank — UNKNOWN if missing
  actorUserId: string;                     // ditto
  clientId: string;                        // OAuth `client_id` claim if any
  action: string;
  toolName: string;                        // === action, kept for clarity
  category: Category;
  permissionKey: string;                   // "master_kill_switch" | perm | UNKNOWN
  decision: Decision;                      // allowed | denied | error
  outcome: "success" | "error" | "denied" | "unknown";
  resource: string;                        // "titles/<uuid>" style, or UNKNOWN
  durationMs: number | null;               // null when not recorded
  correlationId: string;                   // UNKNOWN when not recorded
  errorMessage: string | null;             // already redacted; null when none
  raw: RawAuditRow;                        // untouched original for the detail view
};

// --- helpers -------------------------------------------------------------

const KNOWN_CATEGORIES: readonly Category[] = [
  "db_read", "db_write", "storage_read", "storage_write",
  "edge_invoke", "user_data_export", "control", "oauth", "unknown",
];

function pickString(source: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!source) return null;
  for (const k of keys) {
    const v = source[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

function pickNumber(source: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!source) return null;
  for (const k of keys) {
    const v = source[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}

function categoryFor(action: string, permissionKey: string | null, details: Record<string, unknown> | null | undefined): Category {
  const explicit = pickString(details, ["category"]);
  if (explicit && (KNOWN_CATEGORIES as readonly string[]).includes(explicit)) return explicit as Category;
  const pk = (permissionKey ?? "").toLowerCase();
  if (pk === "allow_db_write") return "db_write";
  if (pk === "allow_db_read") return "db_read";
  if (pk === "allow_storage_write") return "storage_write";
  if (pk === "allow_storage_read") return "storage_read";
  if (pk === "allow_edge_invoke") return "edge_invoke";
  if (pk === "allow_user_data_export") return "user_data_export";
  const a = action.toLowerCase();
  if (a.startsWith("ctrl_") || a.startsWith("control_")) return "control";
  if (a.includes("oauth") || a.includes("token") || a.includes("client")) return "oauth";
  return "unknown";
}

/**
 * Best-effort formatter for the audit list. Never throws on bad timestamps.
 * Kept explicit-locale so unit tests are deterministic across environments.
 */
export function formatAuditTimestamp(iso: string, locale = "en-GB"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return UNKNOWN;
  // e.g. "17 Jul 2026, 20:19:26 UTC"
  return d.toLocaleString(locale, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZone: "UTC", timeZoneName: "short", hour12: false,
  });
}

/**
 * Redact secrets from a free-form error string before we surface it in the UI.
 * Mirror of the server-side redactor in `src/lib/mcp/lib/control.ts` but
 * kept local so the frontend does not pull the mcp-js runtime.
 */
const CLIENT_SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]"],
  [/sbp_[A-Za-z0-9]{20,}/g, "[REDACTED_SUPABASE_PAT]"],
  [/sk_(?:live|test)_[A-Za-z0-9]{20,}/g, "[REDACTED_STRIPE_KEY]"],
  [/rzp_(?:live|test)_[A-Za-z0-9]{10,}/g, "[REDACTED_RAZORPAY_KEY]"],
  [/ghp_[A-Za-z0-9]{30,}/g, "[REDACTED_GITHUB_PAT]"],
  [/AIza[0-9A-Za-z_-]{30,}/g, "[REDACTED_GOOGLE_KEY]"],
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  [/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED_PAN]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, "Bearer [REDACTED]"],
];
export function redactError(input: unknown): string | null {
  if (input == null) return null;
  const raw = typeof input === "string"
    ? input
    : typeof input === "object" && typeof (input as { message?: unknown }).message === "string"
      ? (input as { message: string }).message
      : String(input);
  if (!raw || !raw.trim()) return null;
  let out = raw;
  for (const [re, rep] of CLIENT_SECRET_PATTERNS) out = out.replace(re, rep);
  return out.length > 512 ? out.slice(0, 512) + "…" : out;
}

/**
 * Redact a candidate email for display (keep first char + domain). We only
 * accept fully-formed emails; anything else falls back to UNKNOWN.
 */
export function displayEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return UNKNOWN;
  const at = email.indexOf("@");
  if (at < 1) return UNKNOWN;
  const [local, domain] = [email.slice(0, at), email.slice(at + 1)];
  const first = local.charAt(0);
  const masked = local.length <= 2 ? `${first}•` : `${first}${"•".repeat(Math.max(1, local.length - 2))}${local.charAt(local.length - 1)}`;
  return `${masked}@${domain}`;
}

/** Redact a UUID actor for display (first 8 chars + …). */
export function displayUserId(id: string | null | undefined): string {
  if (!id || typeof id !== "string") return UNKNOWN;
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

// --- main normalizer -----------------------------------------------------

export function normalizeAuditRow(row: RawAuditRow): NormalizedAudit {
  const details = (row.details && typeof row.details === "object") ? row.details : null;

  const errorMessageRaw = pickString(details, ["error", "error_message", "message"]);
  const errorMessage = redactError(errorMessageRaw);

  // A row is an "error" when the handler recorded one, whether or not it was
  // ultimately denied. Denials without an error are just "denied".
  const decision: Decision = errorMessage ? "error" : row.allowed ? "allowed" : "denied";
  const outcome = errorMessage ? "error" : row.allowed ? "success" : "denied";

  const permissionKey = row.permission_key && row.permission_key.trim().length > 0
    ? row.permission_key
    : pickString(details, ["permission_key", "permission"]) ?? UNKNOWN;

  const clientId = pickString(details, ["client_id", "oauth_client_id"]) ?? UNKNOWN;
  const correlationId = pickString(details, ["correlation_id", "request_id", "trace_id"]) ?? UNKNOWN;
  const resource = row.resource && row.resource.trim().length > 0
    ? row.resource
    : pickString(details, ["resource", "target"]) ?? UNKNOWN;
  const durationMs = pickNumber(details, ["duration_ms", "durationMs", "elapsed_ms"]);
  const actorEmail = row.actor_email
    ? displayEmail(row.actor_email)
    : displayEmail(pickString(details, ["actor_email", "email"]));
  const actorUserId = displayUserId(row.actor_user_id ?? pickString(details, ["actor_user_id", "user_id"]));

  return {
    id: row.id,
    timestampIso: row.created_at,
    timestampLabel: formatAuditTimestamp(row.created_at),
    actorEmail,
    actorUserId,
    clientId,
    action: row.action || UNKNOWN,
    toolName: row.action || UNKNOWN,
    category: categoryFor(row.action || "", row.permission_key, details),
    permissionKey,
    decision,
    outcome,
    resource,
    durationMs,
    correlationId,
    errorMessage,
    raw: row,
  };
}

export type AuditFilter = "all" | "allowed" | "denied" | "error";

export function filterAudit(rows: NormalizedAudit[], filter: AuditFilter): NormalizedAudit[] {
  if (filter === "all") return rows;
  return rows.filter((r) => r.decision === filter);
}
