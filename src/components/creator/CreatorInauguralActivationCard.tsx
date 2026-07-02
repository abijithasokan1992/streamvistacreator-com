import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
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
 * After a successful inaugural payment exists for this user the card
 * converts to a non-payable "Inaugural Activation Completed" record so
 * the ceremonial first-payment can never be charged twice.
 */
export const ARUNA_USER_ID = "6d6680c4-156c-4d57-833d-951f56101879";

const BASE_INR = 750;
const GST_PCT = 18;
const TOTAL_INR = Math.round(BASE_INR * (1 + GST_PCT / 100)); // 885

type CompletedInfo = {
  paid_at: string | null;
  order_id: string | null;
  payment_id: string | null;
};

export default function CreatorInauguralActivationCard() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [completed, setCompleted] = useState<CompletedInfo | null>(null);

  useEffect(() => {
    if (!user || user.id !== ARUNA_USER_ID) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Direct table read first (RLS allows self-rows) — falls back to the
        // edge function status probe if the client read returns nothing.
        const { data } = await (supabase as any)
          .from("razorpay_audit_log")
          .select("status, created_at, order_id, payment_id")
          .eq("user_id", user.id)
          .eq("event_type", "inaugural_founder_activation")
          .eq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        const row = Array.isArray(data) && data.length ? data[0] : null;
        if (row) {
          setCompleted({
            paid_at: row.created_at ?? null,
            order_id: row.order_id ?? null,
            payment_id: row.payment_id ?? null,
          });
        } else {
          const probe = await supabase.functions.invoke("inaugural-activation-pay", {
            body: { action: "status" },
          });
          const d: any = probe.data;
          if (!cancelled && d?.completed) {
            setCompleted({
              paid_at: d.paid_at ?? null,
              order_id: d.order_id ?? null,
              payment_id: d.payment_id ?? null,
            });
          }
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user || user.id !== ARUNA_USER_ID) return null;
  if (checking) return null;

  // Completed (one-time ceremonial payment already settled) — render a
  // calm, non-payable record. No live CTA, no duplicate charge possible.
  if (completed) {
    const paidOn = completed.paid_at
      ? new Date(completed.paid_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;
    return (
      <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-accent/5 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 max-w-xl">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-emerald-300 font-mono">
              <CheckCircle2 className="w-3 h-3" /> Inaugural Activation Completed
            </span>
            <h3 className="font-display text-2xl mt-1.5">Founder Direct Activation Payment</h3>
            <p className="text-xs text-muted-foreground mt-1.5">
              This was the first official StreamVista inaugural activation payment. Founder
              premium access (Creator Pro · Founder · 5 TB) is active on this account.
            </p>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-xs">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-semibold text-emerald-300 mt-0.5">Paid</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-semibold mt-0.5">₹{TOTAL_INR.toLocaleString("en-IN")}</dd>
              </div>
              {paidOn && (
                <div>
                  <dt className="text-muted-foreground">Paid on</dt>
                  <dd className="font-semibold mt-0.5">{paidOn}</dd>
                </div>
              )}
              {completed.payment_id && (
                <div className="col-span-2 sm:col-span-3 min-w-0">
                  <dt className="text-muted-foreground">Reference</dt>
                  <dd className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                    {completed.payment_id}
                    {completed.order_id ? ` · ${completed.order_id}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-2 font-semibold">
            <CheckCircle2 className="w-4 h-4" /> Activation complete
          </span>
        </div>
      </section>
    );
  }

  const checkout = async () => {
    if (busy) return;
    setBusy(true);
    const t = toast.loading("Opening Razorpay…");
    try {
      const { data, error } = await supabase.functions.invoke("inaugural-activation-pay", {
        body: { action: "create" },
      });
      if (error) throw error;
      const d: any = data;
      if (d?.completed) {
        toast.dismiss(t);
        setCompleted({
          paid_at: d.paid_at ?? null,
          order_id: d.order_id ?? null,
          payment_id: d.payment_id ?? null,
        });
        toast.message("Inaugural activation already completed.");
        return;
      }
      if (d?.error) throw new Error(d.error);

      await new Promise<void>((resolve) => {
        if ((window as any).Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve();
        document.body.appendChild(s);
      });

      const rzp = new (window as any).Razorpay({
        key: d.keyId,
        order_id: d.orderId,
        amount: d.amount,
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
            setCompleted({
              paid_at: new Date().toISOString(),
              order_id: resp.razorpay_order_id ?? null,
              payment_id: resp.razorpay_payment_id ?? null,
            });
            toast.success("Welcome to StreamVista — your first activation is complete", {
              description:
                "Your inaugural StreamVista activation payment has been received successfully.",
              duration: 10000,
            });
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
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-fuchsia-500 hover:bg-fuchsia-400 text-black text-sm px-4 py-2.5 font-semibold disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Opening…" : "Pay activation · ₹885"}
        </button>
      </div>
    </section>
  );
}
