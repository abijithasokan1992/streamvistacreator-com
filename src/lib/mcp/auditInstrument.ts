/**
 * Phase C · Shared correlation-id + duration helper.
 *
 * Every MCP audit write should carry:
 *   - correlation_id  → matches a single request across client + edge fn
 *   - started_at / ended_at → ISO timestamps (timezone-aware)
 *   - duration_ms     → wall-clock the operation took
 *   - decision        → "allowed" | "denied" | "error"
 *   - category        → high-level bucket for filtering
 *
 * The helpers here are pure and framework-free so the same shape can be
 * emitted from `mcpClient.runGoverned` (frontend) and from the edge
 * function's `authorize()` wrapper (server, uses its own copy — we only
 * ship source here, no deploy).
 */

export type InstrumentDecision = "allowed" | "denied" | "error";

export function newCorrelationId(): string {
  // crypto.randomUUID exists in browsers, Node ≥ 19, Deno.
  try {
    const g = (globalThis as unknown as { crypto?: { randomUUID?: () => string } });
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  } catch { /* fall through */ }
  // Fallback: RFC4122-ish, only used in ancient environments.
  return "cor-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

/** High-level buckets. Never leak params/payload here — only shape metadata. */
export function categoryForPermission(key: string | null | undefined): string {
  switch (key) {
    case "allow_db_read": return "db_read";
    case "allow_db_write": return "db_write";
    case "allow_storage_read": return "storage_read";
    case "allow_storage_write": return "storage_write";
    case "allow_edge_invoke": return "edge_invoke";
    case "allow_user_data_export": return "user_data_export";
    case "master_kill_switch": return "control";
    default: return "unknown";
  }
}

export type InstrumentEnvelope = {
  correlation_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  decision: InstrumentDecision;
  category: string;
  error?: string;
  error_code?: string;
};

/**
 * Build an audit envelope from a start marker. Only records well-known,
 * non-sensitive metadata — no payload, no PII, no token.
 */
export function finishEnvelope(
  start: { correlationId: string; startedAt: number; category: string },
  decision: InstrumentDecision,
  error?: { code?: string; message?: string },
): InstrumentEnvelope {
  const endedMs = Date.now();
  const startedIso = new Date(start.startedAt).toISOString();
  const endedIso = new Date(endedMs).toISOString();
  const env: InstrumentEnvelope = {
    correlation_id: start.correlationId,
    started_at: startedIso,
    ended_at: endedIso,
    duration_ms: Math.max(0, endedMs - start.startedAt),
    decision,
    category: start.category,
  };
  if (error?.message) env.error = error.message.length > 512 ? error.message.slice(0, 512) + "…" : error.message;
  if (error?.code) env.error_code = error.code;
  return env;
}

export function startEnvelope(category: string, correlationId = newCorrelationId()): { correlationId: string; startedAt: number; category: string } {
  return { correlationId, startedAt: Date.now(), category };
}
