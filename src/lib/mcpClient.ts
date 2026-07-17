/**
 * MCP Governance Client.
 *
 * Lightweight client-side gatekeeper that:
 *  1. Reads the admin-controlled `mcp_permissions` toggle row from `admin_settings`.
 *  2. Refuses actions the admin has disabled (or all actions if master_kill_switch is on).
 *  3. Writes every attempt (allowed + denied) to `mcp_audit_log`, with a
 *     correlation-id / duration / decision envelope so C1 renderers can
 *     display consistent metadata across allowed / denied / error rows.
 *
 * The DB-level RLS remains the source of truth — this layer makes denials
 * explicit to the user and produces a real-time admin audit trail.
 */

import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/resilient";
import {
  categoryForPermission,
  finishEnvelope,
  startEnvelope,
  type InstrumentDecision,
} from "@/lib/mcp/auditInstrument";

export type McpPermissionKey =
  | "allow_db_read"
  | "allow_db_write"
  | "allow_storage_read"
  | "allow_storage_write"
  | "allow_edge_invoke"
  | "allow_user_data_export";

export interface McpPermissions {
  allow_db_read: boolean;
  allow_db_write: boolean;
  allow_storage_read: boolean;
  allow_storage_write: boolean;
  allow_edge_invoke: boolean;
  allow_user_data_export: boolean;
  master_kill_switch: boolean;
}

export const DEFAULT_MCP_PERMISSIONS: McpPermissions = {
  allow_db_read: true,
  allow_db_write: false,
  allow_storage_read: true,
  allow_storage_write: false,
  allow_edge_invoke: true,
  allow_user_data_export: false,
  master_kill_switch: false,
};

let cache: { value: McpPermissions; ts: number } | null = null;
const CACHE_MS = 15_000;

export async function getMcpPermissions(force = false): Promise<McpPermissions> {
  if (!force && cache && Date.now() - cache.ts < CACHE_MS) return cache.value;
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "mcp_permissions")
      .maybeSingle();
    const v = (data?.value as Partial<McpPermissions>) || {};
    const merged: McpPermissions = { ...DEFAULT_MCP_PERMISSIONS, ...v };
    cache = { value: merged, ts: Date.now() };
    return merged;
  } catch {
    return DEFAULT_MCP_PERMISSIONS;
  }
}

export function invalidateMcpPermissionsCache() {
  cache = null;
}

async function logAudit(entry: {
  action: string;
  resource?: string;
  permission_key?: string;
  allowed: boolean;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("mcp_audit_log").insert({
      actor_user_id: u.user?.id ?? null,
      actor_email: u.user?.email ?? null,
      action: entry.action,
      resource: entry.resource ?? null,
      permission_key: entry.permission_key ?? null,
      allowed: entry.allowed,
      details: (entry.details ?? {}) as never,
    });
  } catch {
    // never let auditing fail the caller
  }
}

export class McpPermissionError extends Error {
  permissionKey: string;
  constructor(key: string, action: string) {
    super(`MCP permission "${key}" is disabled by admin. Action "${action}" was blocked.`);
    this.name = "McpPermissionError";
    this.permissionKey = key;
  }
}

/** Run a governed action with audit. Throws McpPermissionError if denied. */
export async function runGoverned<T>(opts: {
  permission: McpPermissionKey;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  run: () => Promise<T>;
}): Promise<T> {
  const perms = await getMcpPermissions();
  const category = categoryForPermission(opts.permission);
  const start = startEnvelope(category);

  const recordDenied = async (blockingKey: string, reason: string) => {
    const env = finishEnvelope(start, "denied" as InstrumentDecision, { code: reason });
    await logAudit({
      action: opts.action,
      resource: opts.resource,
      permission_key: blockingKey,
      allowed: false,
      details: { ...(opts.details ?? {}), ...env, blocking_permission: blockingKey },
    });
  };

  if (perms.master_kill_switch) {
    await recordDenied("master_kill_switch", "kill_switch");
    throw new McpPermissionError("master_kill_switch", opts.action);
  }
  if (!perms[opts.permission]) {
    await recordDenied(opts.permission, "permission_off");
    throw new McpPermissionError(opts.permission, opts.action);
  }

  try {
    const value = await withRetry(opts.run, { label: opts.action });
    const env = finishEnvelope(start, "allowed");
    await logAudit({
      action: opts.action,
      resource: opts.resource,
      permission_key: opts.permission,
      allowed: true,
      details: { ...(opts.details ?? {}), ...env },
    });
    return value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    const env = finishEnvelope(start, "error", { message, code: "runtime_error" });
    await logAudit({
      action: opts.action,
      resource: opts.resource,
      permission_key: opts.permission,
      allowed: false, // an errored attempt is not a success — surfaced as decision="error" in UI via `details.decision`
      details: { ...(opts.details ?? {}), ...env },
    });
    throw err;
  }
}

