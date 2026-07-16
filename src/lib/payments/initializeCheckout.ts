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

    const rzp = new (window as any).Razorpay({
      key: (data as any).keyId,
      order_id: (data as any).orderId,
      amount: (data as any).amount,
      currency: (data as any).currency || "INR",
      name: "StreamVista",
      description: description || label || "Secure payment",
      prefill: {
        email: prefill?.email ?? sess?.session?.user?.email ?? undefined,
        contact: prefill?.contact,
        name: prefill?.name,
      },
      notes: enrichedMetadata as Record<string, string>,
      theme: { color: themeColor || "#a855f7" },
      modal: { ondismiss: () => onDismiss?.() },
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
          onSuccess?.(verify.data);
        } catch (e: any) {
          toast.error(e?.message || "Payment verification failed", { id: toastId });
          onError?.(e instanceof Error ? e : new Error(String(e)));
        }
      },
    });
    toast.dismiss(toastId);
    rzp.open();
  } catch (e: any) {
    toast.error(e?.message || "Could not start checkout", { id: toastId });
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
