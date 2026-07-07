// Correlation-ID helper for edge functions.
// Mirrors src/lib/correlation.ts so ids propagate frontend → edge → DB → logs.
export const CORRELATION_HEADER = "x-correlation-id";

export function readCorrelationId(req: Request): string {
  const h = req.headers;
  const id = h.get(CORRELATION_HEADER) ?? h.get(CORRELATION_HEADER.toUpperCase());
  if (id && id.length <= 128) return id;
  return crypto.randomUUID();
}

/** Attach the id to every response for client-side stitching. */
export function withCorrelation(headers: HeadersInit, correlationId: string): HeadersInit {
  return { ...headers, [CORRELATION_HEADER]: correlationId };
}

/** Structured log line — one JSON object per event. */
export function logEvent(correlationId: string, event: string, fields: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), cid: correlationId, event, ...fields }));
  } catch {
    console.log(`[${correlationId}] ${event}`);
  }
}
