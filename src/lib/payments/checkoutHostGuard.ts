/**
 * Razorpay live-checkout host guard.
 *
 * Per the merchant account configuration with Razorpay (Merchant ID S5atjWLWSQYfDj),
 * live customer payments are approved only on the production domain
 * https://streamvista.in (the bare domain is canonical; the www
 * variant is accepted for compatibility). Preview / staging / *.lovable.app
 * hosts must not initiate user-facing Razorpay checkout sessions.
 *
 * Admin test-mode tooling (RazorpayTestCheckout) intentionally bypasses this
 * guard and is restricted to admins by RLS on the server side.
 */

const APPROVED_LIVE_HOSTS = new Set<string>([
  // New canonical root domain.
  "streamvista.in",
  "www.streamvista.in",
  "app.streamvista.in",
  // Legacy Razorpay-approved domain — retained during the migration window
  // as a fallback so live checkout does not break while DNS/SSL cut over.
  "streamvistacreator.com",
  "www.streamvistacreator.com",
]);


export function isApprovedLiveCheckoutHost(): boolean {
  if (typeof window === "undefined") return false;
  return APPROVED_LIVE_HOSTS.has(window.location.hostname.toLowerCase());
}

/**
 * Throws a user-facing Error if the current host is not the approved
 * production domain. Call this before any user-facing Razorpay checkout
 * invocation (create order + open checkout.js).
 */
export function assertLiveCheckoutHost(): void {
  if (isApprovedLiveCheckoutHost()) return;
  throw new Error(
    "Live payments are available only on https://streamvista.in. " +
      "This preview environment cannot accept customer payments.",
  );
}
