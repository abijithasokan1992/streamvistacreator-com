/**
 * Resilient async wrapper with exponential backoff + jitter.
 * Used by Supabase calls and OCI/Edge fetches so transient failures
 * (network blips, 5xx, rate limits) don't crash the UI.
 */

export interface RetryOptions {
  retries?: number;
  baseMs?: number;
  maxMs?: number;
  /** Return true if the error/result should trigger another attempt. */
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const defaultShouldRetry = (err: unknown) => {
  const e = err as { status?: number; code?: string; message?: string } | undefined;
  if (!e) return true;
  if (e.status && e.status >= 500) return true;
  if (e.status === 429) return true;
  const msg = (e.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("temporar") ||
    msg.includes("econnreset")
  );
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    retries = 4,
    baseMs = 300,
    maxMs = 4000,
    shouldRetry = defaultShouldRetry,
    onRetry,
    label,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !shouldRetry(err, attempt)) break;
      const delay = Math.min(maxMs, baseMs * 2 ** attempt) + Math.floor(Math.random() * 200);
      if (onRetry) onRetry(err, attempt + 1, delay);
      if (label && import.meta.env.DEV) {
        console.warn(`[resilient:${label}] attempt ${attempt + 1} failed, retrying in ${delay}ms`, err);
      }
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** Wrap a Supabase query builder call (returns { data, error }). Throws on error so retry can catch. */
export async function resilientQuery<T>(
  builder: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>,
  opts: RetryOptions = {}
): Promise<T> {
  return withRetry(async () => {
    const { data, error } = await builder();
    if (error) {
      const err = new Error(error.message) as Error & { code?: string };
      err.code = error.code;
      throw err;
    }
    return data as T;
  }, opts);
}
