export function isRetryableWebhookProcessingError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();

  if (message.includes("[permanent]")) return false;
  if (message.includes("[retryable]")) return true;

  const permanentSignals = [
    "invalid signature",
    "validation",
    "bad json",
    "malformed",
    "unauthorized",
    "forbidden",
    "permission denied",
    "not found",
    "already exists",
  ];
  if (permanentSignals.some((signal) => message.includes(signal))) return false;

  const retryableSignals = [
    "timeout",
    "timed out",
    "temporarily",
    "temporary",
    "network",
    "connection",
    "econn",
    "fetch failed",
    "rate limit",
    "too many requests",
    "resource exhausted",
    "resource temporarily unavailable",
    "deadlock",
    "could not serialize",
    "pool",
    "502",
    "503",
    "504",
  ];
  if (retryableSignals.some((signal) => message.includes(signal))) return true;

  // Default to retryable to avoid dropping billable events when classification
  // is uncertain.
  return true;
}
