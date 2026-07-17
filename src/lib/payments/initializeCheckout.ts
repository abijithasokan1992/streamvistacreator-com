/**
 * initializeCheckout — Global payment invocation helper.
 *
 * A single entry point every dashboard uses to open Razorpay checkout.
 * Responsibilities:
 *   1. Force a clean auth-session refresh so no stale token is sent.
 *   2. Invoke the correct `create-*` edge function for the requested purpose.
 *   3. Forward caller-supplied metadata (workspace_id, purpose, extras) so the
 *      backend webhook can route permissions without ever consulting the
 *      client session.
 *   4. Load the Razorpay script on demand and open Checkout.
 *   5. On payment success, invoke the matching `verify-*` edge function with
 *      a freshly-refreshed token.
 *
 * Callers should treat this as the *only* client-side path to Razorpay.
 * The Title Workspace modal is preserved verbatim — it delegates to this
 * helper internally.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * MANDATORY CALLBACK CONTRACT — read before integrating.
 * ─────────────────────────────────────────────────────────────────────────
 * Every caller MUST wire ALL THREE of `onSuccess`, `onDismiss`, and `onError`.
 * These callbacks are non-overlapping and must be handled independently:
 *
 *   • onSuccess — fires exactly once after `verify-*` returns a valid receipt.
 *   • onError   — fires on create/verify/HTTP/signature failures. Does NOT
 *                 fire when the user closes the Razorpay sheet.
 *   • onDismiss — fires when the user manually closes the Razorpay modal,
 *                 INCLUDING when they close it after a `payment.failed`
 *                 event. Razorpay does not re-emit failures through
 *                 `onError` in that case — if you skip `onDismiss`, a
 *                 failed-then-dismissed payment leaves the UI silent
 *                 (no toast, no lifecycle reset, spinner may linger).
 *
 * Minimum required wiring:
 *
 *   initializeCheckout({
 *     …,
 *     onSuccess: (r) => { … },
 *     onError:   (e) => { toast.error(e.message); resetSubmissionLock(); },
 *     onDismiss: ()  => { toast.dismiss(); resetSubmissionLock(); },
 *   });
 *
 * Do NOT rely on `onError` alone. Do NOT collapse `onDismiss` into
 * `onError` — the modal-close path has no error object. Callers that
 * use `useModalSubmissionLifecycle` MUST call its reset from BOTH
 * `onError` and `onDismiss` to prevent stuck submission locks.
 * ─────────────────────────────────────────────────────────────────────────
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";

export type CheckoutPurpose =
  | "storage_topup"
  | "vault_purchase"
  | "plan_upgrade"
  | "distribution_unlock"
  | "premium_feature";

export interface CheckoutMetadata {
  workspace_id?: string | null;
  user_id?: string | null;
  payment_purpose?: string;
  /** Free-form extras forwarded to Razorpay `notes` and the webhook payload. */
  [k: string]: string | number | boolean | null | undefined;
}

export interface InitializeCheckoutOptions {
  /** Semantic purpose; picks the create/verify edge function pair. */
  purpose: CheckoutPurpose;
  /** Body passed to the create-* function (tier payload, plan code, etc.). */
  payload: Record<string, unknown>;
  /** Contextual metadata forwarded to webhook via Razorpay notes. */
  metadata?: CheckoutMetadata;
  /** Human-visible label surfaced in the Razorpay checkout sheet. */
  label?: string;
  description?: string;
  themeColor?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  /** Called after successful verify. */
  onSuccess?: (result: unknown) => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

interface EndpointPair {
  create: string;
  verify: string;
}

const ENDPOINTS: Record<CheckoutPurpose, EndpointPair> = {
  storage_topup: { create: "create-storage-topup", verify: "verify-storage-topup" },
  vault_purchase: { create: "create-vault-purchase", verify: "verify-storage-topup" },
  plan_upgrade: { create: "create-storage-topup", verify: "verify-storage-topup" },
  distribution_unlock: { create: "create-storage-topup", verify: "verify-storage-topup" },
  premium_feature: { create: "create-storage-topup", verify: "verify-storage-topup" },
};

async function freshAccessToken(): Promise<string> {
  // refreshSession returns the newest token; fall through to getSession if the
  // refresh call is rate-limited or the token is still valid.
  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch {/* ignore */}
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  return token;
}

let razorpayLoader: Promise<void> | null = null;
async function ensureRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return;
  if (!razorpayLoader) {
    razorpayLoader = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        razorpayLoader = null;
        reject(new Error("Failed to load Razorpay checkout script"));
      };
      document.body.appendChild(s);
    });
  }
  return razorpayLoader;
}

export async function initializeCheckout(opts: InitializeCheckoutOptions): Promise<void> {
  const { purpose, payload, metadata, label, description, themeColor, prefill, onSuccess, onDismiss, onError } = opts;
  const endpoints = ENDPOINTS[purpose];
  const toastId = toast.loading("Opening secure checkout…");

  try {
    assertLiveCheckoutHost();
    const token = await freshAccessToken();

    // Enrich metadata with user id so webhook always has authoritative context.
    const { data: sess } = await supabase.auth.getSession();
    const enrichedMetadata: CheckoutMetadata = {
      ...metadata,
      user_id: metadata?.user_id ?? sess?.session?.user?.id ?? null,
      payment_purpose: metadata?.payment_purpose ?? purpose,
    };

    const { data, error } = await supabase.functions.invoke(endpoints.create, {
      body: { ...payload, __metadata: enrichedMetadata },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error) throw new Error(error.message || "Checkout could not start");
    if ((data as any)?.error) throw new Error((data as any).error);

    await ensureRazorpay();

    // Only pass non-empty prefill values to Razorpay. Empty/null/undefined
    // (or whitespace-only) values still cause the checkout modal to lock the
    // corresponding field, preventing users from positioning their cursor
    // and typing manually.
    const rzpPrefill: Record<string, string> = {};
    const clean = (v: unknown): string | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    };
    const prefillEmail = clean(prefill?.email) ?? clean(sess?.session?.user?.email);
    const prefillContact = clean(prefill?.contact);
    const prefillName = clean(prefill?.name);
    if (prefillEmail) rzpPrefill.email = prefillEmail;
    if (prefillContact) rzpPrefill.contact = prefillContact;
    if (prefillName) rzpPrefill.name = prefillName;

    // Visual-only lock: toggle a body attribute so `index.css` can dim/blur
    // the app underneath. Never uses `pointer-events: none` — if Razorpay
    // ever fails to mount, users are not trapped.
    //
    // IMPORTANT — Radix pointer-events leak fix:
    // When Razorpay is opened from inside a Radix Dialog / Sheet /
    // AlertDialog, Radix writes `pointer-events: none` inline on
    // `document.body` for the duration of the modal. Razorpay's checkout
    // iframe is portaled to `document.body`, so it inherits that lock —
    // the phone / email / card fields render but every click is swallowed.
    // We snapshot the prior inline value, force pointer-events back to
    // `auto` on <html> and <body> while checkout is open, and restore the
    // original on close so Radix's own cleanup still works.
    let priorBodyPE = "";
    let priorHtmlPE = "";
    const setCheckoutOpen = (open: boolean) => {
      try {
        if (open) {
          document.body.setAttribute("data-checkout-open", "true");
          priorBodyPE = document.body.style.pointerEvents;
          priorHtmlPE = document.documentElement.style.pointerEvents;
          document.body.style.pointerEvents = "auto";
          document.documentElement.style.pointerEvents = "auto";
        } else {
          document.body.removeAttribute("data-checkout-open");
          document.body.style.pointerEvents = priorBodyPE;
          document.documentElement.style.pointerEvents = priorHtmlPE;
        }
      } catch { /* SSR / detached DOM — noop */ }
    };
    const clearCheckoutOpen = () => setCheckoutOpen(false);

    const rzp = new (window as any).Razorpay({
      key: (data as any).keyId,
      order_id: (data as any).orderId,
      amount: (data as any).amount,
      currency: (data as any).currency || "INR",
      name: "StreamVista",
      description: description || label || "Secure payment",
      prefill: rzpPrefill,
      notes: enrichedMetadata as Record<string, string>,
      theme: { color: themeColor || "#a855f7" },
      modal: {
        ondismiss: () => {
          clearCheckoutOpen();
          onDismiss?.();
        },
      },
      handler: async (resp: any) => {
        try {
          const verifyToken = await freshAccessToken();
          const verify = await supabase.functions.invoke(endpoints.verify, {
            body: {
              topupId: (data as any).topupId,
              purchaseId: (data as any).purchaseId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              __metadata: enrichedMetadata,
            },
            headers: { Authorization: `Bearer ${verifyToken}` },
          });
          if (verify.error || (verify.data as any)?.error) {
            throw new Error(
              (verify.data as any)?.error || verify.error?.message || "Payment verification failed",
            );
          }
          toast.success("Payment successful", { id: toastId });
          clearCheckoutOpen();
          onSuccess?.(verify.data);
        } catch (e: any) {
          toast.error(e?.message || "Payment verification failed", { id: toastId });
          clearCheckoutOpen();
          onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      },
    });
    toast.dismiss(toastId);
    setCheckoutOpen(true);
    rzp.open();
  } catch (e: any) {
    try { document.body.removeAttribute("data-checkout-open"); } catch { /* noop */ }
    toast.error(e?.message || "Could not start checkout", { id: toastId });
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
