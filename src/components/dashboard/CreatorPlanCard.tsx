import { useState } from "react";
import { Check, Loader2, Sparkles, Zap, Archive } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * CreatorPlanCard
 * ────────────────
 * Flagship pricing card for StreamVista's Creator Plan.
 *
 *  • ₹650 / TB · / month + 18% GST = ₹767 / mo (pay-as-you-go)
 *  • CTA: "Get 1 TB · ₹767/mo" → invokes the existing
 *    `create-storage-topup` edge function and opens Razorpay Checkout.
 *  • On verification, calls `verify-storage-topup` (handled by the
 *    existing flow used in StorageUsageCard).
 *
 * No new backend, no new secrets. Payments route directly to the
 * StreamVista Razorpay account already configured.
 */

const BENEFITS = [
  "1 TB cinema-grade storage",
  "Unmetered review bandwidth",
  "Free parking for finished projects",
  "Multi-studio routing",
  "Camera-to-cloud ingest",
  "Frame-accurate client review",
  "Priority Razorpay / UPI checkout",
];

export default function CreatorPlanCard({ onPurchased }: { onPurchased?: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const checkout = async () => {
    if (!user) {
      toast.error("Sign in to subscribe");
      return;
    }
    setBusy(true);
    const t = toast.loading("Opening Razorpay…");
    try {
      const { data, error } = await supabase.functions.invoke("create-storage-topup", {
        body: { tb: 1 },
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
        name: "StreamVista Cloud X",
        description: "Creator Plan · 1 TB / month",
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async (resp: any) => {
          const v = await supabase.functions.invoke("verify-storage-topup", {
            body: {
              topupId: data.topupId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          if (v.error || (v.data as any)?.error) {
            toast.error("Payment verification failed");
          } else {
            toast.success("Creator Plan activated — 1 TB added 🎉");
            onPurchased?.();
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
    <div className="relative rounded-2xl overflow-hidden border border-accent/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 shadow-lg">
      {/* Glow accent */}
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-accent bg-accent/10 border border-accent/30 px-2 py-1 rounded-full mb-2">
            <Sparkles className="w-3 h-3" /> Flagship · Pay-As-You-Go
          </span>
          <h3 className="font-display text-2xl font-bold">Creator Plan</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            1 TB cinema-grade storage with auto top-up. Each extra TB unlocks on demand at the same price.
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="font-display text-3xl font-extrabold leading-none">
            ₹650<span className="text-base font-semibold text-muted-foreground">/TB</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">+ 18% GST</div>
          <div className="text-xs font-semibold text-accent mt-0.5">
            Total ₹767 / mo
          </div>
        </div>
      </div>

      <ul className="relative grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mb-5">
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={checkout}
        disabled={busy}
        className={cn(
          "relative w-full h-12 rounded-xl text-base font-bold inline-flex items-center justify-center gap-2",
          "bg-gradient-primary text-primary-foreground glow-primary hover:opacity-95 transition-all",
          "disabled:opacity-60 disabled:cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
        {busy ? "Opening Razorpay…" : "Get 1 TB · ₹767 / mo"}
      </button>

      <div className="relative mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <Archive className="w-3 h-3 inline -mt-0.5 mr-1 text-accent" />
          <b className="text-foreground">Overage policy:</b> Free plan bandwidth overage is billed only when you exceed{" "}
          <b>500 GB / month at ₹10 / GB</b>. Creator Plan auto-scales storage — each extra TB is added on demand at{" "}
          <b>₹650 + 18% GST</b>. No commitments, cancel anytime.
        </p>
      </div>
    </div>
  );
}
