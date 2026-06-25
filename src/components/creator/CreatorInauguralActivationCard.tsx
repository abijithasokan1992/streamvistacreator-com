import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * CreatorInauguralActivationCard
 *
 * One-time ₹750 + 18% GST (= ₹885) inaugural founder activation payment
 * surface. Shown only to CA Aruna Sankar. Reuses the existing Razorpay
 * checkout pattern — does NOT replace billing, plan, or storage logic.
 *
 * Special-case success handling (custom in-app notification + custom
 * confirmation email) lives in the `inaugural-activation-pay` edge fn.
 */
export const ARUNA_USER_ID = "6d6680c4-156c-4d57-833d-951f56101879";

const BASE_INR = 750;
const GST_PCT = 18;
const TOTAL_INR = Math.round(BASE_INR * (1 + GST_PCT / 100)); // 885

export default function CreatorInauguralActivationCard() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!user || user.id !== ARUNA_USER_ID) return null;

  const checkout = async () => {
    if (busy) return;
    setBusy(true);
    const t = toast.loading("Opening Razorpay…");
    try {
      const { data, error } = await supabase.functions.invoke("inaugural-activation-pay", {
        body: { action: "create" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      await new Promise<void>((resolve) => {
        if ((window as any).Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: "INR",
        name: "StreamVista",
        description: "Inaugural founder activation",
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async (resp: any) => {
          const v = await supabase.functions.invoke("inaugural-activation-pay", {
            body: {
              action: "verify",
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (v.error || (v.data as any)?.error || !(v.data as any)?.verified) {
            toast.error("Payment verification failed");
          } else {
            setDone(true);
            toast.success("Welcome to StreamVista — your first activation is complete", {
              description:
                "Your inaugural StreamVista activation payment has been received successfully.",
              duration: 10000,
            });
            // Refresh so any cached free-tier/entitlement state is re-read.
            setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 1800);
          }
        },
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e: any) {
      toast.error(e?.message || "Checkout failed", { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-background to-accent/10 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-fuchsia-300 font-mono">
            <Sparkles className="w-3 h-3" /> Inaugural founder activation
          </span>
          <h3 className="font-display text-2xl mt-1.5">First StreamVista activation</h3>
          <p className="text-xs text-muted-foreground mt-1.5">
            A one-time activation payment that marks the very first official transaction on the
            StreamVista platform. This is not the 5 TB Creator Pro plan — that remains a separate
            upgrade.
          </p>
          <p className="text-sm mt-3">
            <span className="font-display text-2xl">₹{TOTAL_INR.toLocaleString("en-IN")}</span>
            <span className="text-muted-foreground"> total</span>
            <span className="text-xs text-muted-foreground ml-2">
              (₹{BASE_INR.toLocaleString("en-IN")} + {GST_PCT}% GST)
            </span>
          </p>
        </div>
        <button
          onClick={checkout}
          disabled={busy || done}
          className="inline-flex items-center gap-2 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-black text-sm px-4 py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {done ? "Activation complete" : busy ? "Opening…" : "Pay activation · ₹885"}
        </button>
      </div>
    </section>
  );
}
