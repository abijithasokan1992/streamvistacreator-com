import { supabase } from "@/integrations/supabase/client";

export type TelemetryAction =
  | "checkout.sdk_loaded"
  | "checkout.modal_init"
  | "checkout.modal_opened"
  | "checkout.modal_dismissed"
  | "checkout.handler_success"
  | "checkout.handler_error"
  | "checkout.network_error"
  | "legacy.checkout_storage_visit";

interface TelemetryPayload {
  action_type: TelemetryAction;
  severity?: "INFO" | "WARN" | "ERROR";
  order_id?: string | null;
  payment_id?: string | null;
  error_message?: string | null;
  duration_ms?: number | null;
  extra?: Record<string, unknown>;
}

/**
 * Best-effort fire-and-forget telemetry log for the Razorpay checkout
 * lifecycle. Never throws; failures are swallowed so they cannot break
 * the upgrade flow.
 */
export function logCheckoutTelemetry(payload: TelemetryPayload): void {
  try {
    void supabase.functions.invoke("payment-telemetry", { body: payload });
  } catch (e) {
    // intentional no-op
    console.debug("telemetry invoke failed", e);
  }
}
