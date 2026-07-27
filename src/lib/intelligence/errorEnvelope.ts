/**
 * Pure mapper for the `intelligence-agent` / `research-firecrawl` 200-OK
 * error envelope. Ensures a successful empty result set stays distinguishable
 * from an upstream failure and every documented error code has a friendly
 * user-facing message.
 */
export interface IntelligenceEnvelope<T = unknown> {
  error?: string;
  upstream_message?: string;
  results?: T[];
  [k: string]: unknown;
}

export type IntelligenceOutcome<T> =
  | { kind: "ok"; results: T[]; empty: boolean }
  | { kind: "error"; code: string; message: string };

const FRIENDLY: Record<string, string> = {
  firecrawl_not_connected: "Firecrawl not connected. Link it in Settings → Integrations.",
  firecrawl_auth_failed: "Firecrawl API key rejected (check FIRECRAWL_API_KEY).",
  search_failed: "Upstream search failed. Try again in a moment.",
  internal_error: "Intelligence agent hit an internal error.",
  timeout: "Search timed out.",
  malformed_response: "Upstream returned a malformed response.",
};

export function interpretIntelligence<T>(payload: IntelligenceEnvelope<T> | null | undefined): IntelligenceOutcome<T> {
  if (!payload) return { kind: "error", code: "malformed_response", message: FRIENDLY.malformed_response };
  if (payload.error) {
    const friendly = FRIENDLY[payload.error] ?? payload.error;
    const message = payload.upstream_message ? `${friendly} (${payload.upstream_message})` : friendly;
    return { kind: "error", code: payload.error, message };
  }
  // Missing `results` when there is no error is treated as malformed — a
  // healthy zero-result response is `{ results: [] }`, not `{}`.
  if (!Array.isArray(payload.results)) {
    return { kind: "error", code: "malformed_response", message: FRIENDLY.malformed_response };
  }
  return { kind: "ok", results: payload.results, empty: payload.results.length === 0 };
}
