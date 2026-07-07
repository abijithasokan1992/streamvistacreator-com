/**
 * Correlation-ID plumbing for StreamVista.
 *
 * A correlation ID (a.k.a. request/trace id) tags a single logical user action
 * — an upload, an email send, a payment, an AI call — so we can trace it
 * across frontend → edge function → database → logs → background jobs.
 *
 * Rules:
 *  - One id per user action. Reuse the same id for every network call the
 *    action makes. Do NOT mint a new one per fetch.
 *  - Always sent as the `x-correlation-id` HTTP header.
 *  - Also written into DB records (metadata.correlation_id) so failures can be
 *    joined back to the originating action.
 *  - Never contains PII — it's just a random UUID.
 */

const HEADER = "x-correlation-id";

/** Generate a fresh correlation id for a new user action. */
export function newCorrelationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — not cryptographically strong, but unique enough
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Header key clients and edge functions agree on. */
export const CORRELATION_HEADER = HEADER;

/**
 * Build the standard header block for a fetch / supabase.functions.invoke call.
 * Reuse the same id across every hop of one user action.
 */
export function correlationHeaders(id: string): Record<string, string> {
  return { [HEADER]: id };
}

/**
 * Read a correlation id from a Request/Headers (edge function side).
 * Returns null when absent — callers decide whether to mint one.
 */
export function readCorrelationId(headers: Headers | Record<string, string>): string | null {
  const get = (k: string) =>
    headers instanceof Headers ? headers.get(k) : (headers[k] ?? headers[k.toLowerCase()] ?? null);
  return get(HEADER) ?? get(HEADER.toUpperCase()) ?? null;
}
