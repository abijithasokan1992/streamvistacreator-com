export type RecoveryClassification =
  | "transient"
  | "rate_limited"
  | "reauth_required"
  | "forbidden"
  | "permanent";

const TRANSIENT_PATTERNS = [
  /timeout/i,
  /network/i,
  /fetch failed/i,
  /connection reset/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /bad gateway/i,
  /gateway timeout/i,
  /econnreset/i,
  /socket hang up/i,
];

const REAUTH_PATTERNS = [
  /jwt expired/i,
  /invalid jwt/i,
  /invalid token/i,
  /token.*expired/i,
  /not authenticated/i,
  /unauthenticated/i,
  /refresh token/i,
  /oauth/i,
];

export function classifyRecoveryError(error: unknown): RecoveryClassification {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/rate.?limit|too many requests|\b429\b/i.test(message)) return "rate_limited";
  if (/forbidden|permission denied|\b403\b/i.test(message)) return "forbidden";
  if (REAUTH_PATTERNS.some((pattern) => pattern.test(message))) return "reauth_required";
  if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))) return "transient";
  return "permanent";
}

export async function withRecovery<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number } = {},
): Promise<{ value: T; attempts: number }> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 5));
  const baseDelayMs = Math.max(50, options.baseDelayMs ?? 250);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      lastError = error;
      const classification = classifyRecoveryError(error);
      if (classification !== "transient" && classification !== "rate_limited") throw error;
      if (attempt === attempts) break;
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1) + jitter));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "recovery_failed"));
}
