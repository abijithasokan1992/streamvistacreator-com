/**
 * initializeCheckout — Global payment invocation helper.
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";
import { logCheckoutTelemetry } from "@/lib/paymentTelemetry";

/** Shape Razorpay emits on the `payment.failed` event. All fields optional. */
export interface RazorpayFailedEvent {
  error?: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

/** Minimal surface of the Razorpay instance this helper relies on. */
interface RazorpayInstance {
  open: () => void;
  on?: (event: "payment.failed", handler: (evt: RazorpayFailedEvent) => void) => void;
}

/**
 * Derive a safe, user-facing message from a Razorpay failure event.
 * Never surfaces raw codes or internal fields on their own.
 */
export function razorpayFailureMessage(evt: RazorpayFailedEvent | undefined): string {
  const description = evt?.error?.description?.trim();
  if (description) return description;
  const reason = evt?.error?.reason?.trim();
  if (reason) return reason;
  return "Payment failed. No amount was charged — please try again.";
}


export type CheckoutPurpose =
  | "storage_topup"
  | "vault_purchase"
  | "plan_upgrade"
  | "distribution_unlock"
  | "premium_feature"
  | "service_order";

export interface CheckoutMetadata {
  workspace_id?: string | null;
  user_id?: string | null;
  payment_purpose?: string;
  [k: string]: string | number | boolean | null | undefined;
}

export interface InitializeCheckoutOptions {
  purpose: CheckoutPurpose;
  payload: Record<string, unknown>;
  metadata?: CheckoutMetadata;
  label?: string;
  description?: string;
  themeColor?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  onSuccess?: (result: unknown) => void;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

interface EndpointPair { create: string; verify: string }

const ENDPOINTS: Record<CheckoutPurpose, EndpointPair> = {
  storage_topup: { create: "create-storage-topup", verify: "verify-storage-topup" },
  vault_purchase: { create: "create-vault-purchase", verify: "verify-storage-topup" },
  plan_upgrade: { create: "create-storage-topup", verify: "verify-storage-topup" },
  distribution_unlock: { create: "create-storage-topup", verify: "verify-storage-topup" },
  premium_feature: { create: "create-storage-topup", verify: "verify-storage-topup" },
  service_order: { create: "create-service-order", verify: "verify-service-order" },
};

async function freshAccessToken(): Promise<string> {
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

    const clean = (v: unknown): string | undefined => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t.length > 0 ? t : undefined;
    };
    const rzpPrefill: Record<string, string> = {};
    const prefillEmail = clean(prefill?.email) ?? clean(sess?.session?.user?.email);
    const prefillContact = clean(prefill?.contact);
    const prefillName = clean(prefill?.name);
    if (prefillEmail) rzpPrefill.email = prefillEmail;
    if (prefillContact) rzpPrefill.contact = prefillContact;
    if (prefillName) rzpPrefill.name = prefillName;

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
      } catch {/* noop */}
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
      modal: { ondismiss: () => { clearCheckoutOpen(); onDismiss?.(); } },
      handler: async (resp: any) => {
        try {
          const verifyToken = await freshAccessToken();
          const verify = await supabase.functions.invoke(endpoints.verify, {
            body: {
              topupId: (data as any).topupId,
              purchaseId: (data as any).purchaseId,
              serviceOrderId: (data as any).serviceOrderId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              __metadata: enrichedMetadata,
            },
            headers: { Authorization: `Bearer ${verifyToken}` },
          });
          if (verify.error || (verify.data as any)?.error) {
            throw new Error((verify.data as any)?.error || verify.error?.message || "Payment verification failed");
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
    try { document.body.removeAttribute("data-checkout-open"); } catch {/* noop */}
    toast.error(e?.message || "Could not start checkout", { id: toastId });
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
