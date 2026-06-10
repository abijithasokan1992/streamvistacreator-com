// Shared structured-logging helper for the Razorpay checkout lifecycle.
// All entries land in public.payment_debug_logs (admin-readable) so the
// admin can filter by action_type / order_id / payment_id / severity.

export type Severity = "INFO" | "WARN" | "ERROR";

export interface PaymentLog {
  severity?: Severity;
  action_type: string;             // e.g. 'order.create', 'webhook.signature', 'webhook.ledger', 'verify.complete'
  source?: "edge" | "frontend" | "webhook" | "admin";
  user_id?: string | null;
  order_id?: string | null;
  payment_id?: string | null;
  event_id?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
  extra?: Record<string, unknown>;
}

export async function logPayment(supabaseAdmin: any, entry: PaymentLog): Promise<void> {
  try {
    await supabaseAdmin.from("payment_debug_logs").insert({
      severity: entry.severity ?? "INFO",
      action_type: entry.action_type,
      source: entry.source ?? "edge",
      user_id: entry.user_id ?? null,
      order_id: entry.order_id ?? null,
      payment_id: entry.payment_id ?? null,
      event_id: entry.event_id ?? null,
      error_message: entry.error_message ?? null,
      duration_ms: entry.duration_ms ?? null,
      extra: entry.extra ?? {},
    });
  } catch (e) {
    // Never let logging block the request path.
    console.error("payment-logger insert failed:", e, entry);
  }
}

// Convenience: start a timer and return a function that logs duration.
export function timer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
