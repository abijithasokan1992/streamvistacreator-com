import { useCallback, useEffect, useState } from "react";
import { HardDrive, Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assertLiveCheckoutHost } from "@/lib/payments/checkoutHostGuard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Subtle, non-intrusive two-tone system alert (WebAudio, no asset needed). */
function playSubtleAlert() {
  try {
    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const play = (freq: number, at: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, ctx.currentTime + at);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + dur + 0.02);
    };
    play(880, 0, 0.18);
    play(1174, 0.14, 0.22);
    setTimeout(() => { try { ctx.close(); } catch {} }, 800);
  } catch {/* silent */}
}

/**
 * PremiumStorageTopupModal
 *
 * Creator-facing modal that surfaces the three canonical storage top-up tiers
 * and routes each to the existing Razorpay flow (`create-storage-topup` →
 * Razorpay Checkout → `verify-storage-topup`). Kept intentionally
 * presentation-only — pricing is derived from the canonical per-TB price on
 * the server, so the labels here are indicative only.
 */

type Tier = {
  id: "gb100" | "gb500" | "tb1";
  label: string;
  headline: string;
  blurb: string;
  approxInr: string;
  payload: { gb: 100 } | { gb: 500 } | { tb: 1 };
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "gb100",
    label: "+100 GB",
    headline: "Rush add-on",
    blurb: "Best for a single 4K feature or a short slate of trailers.",
    approxInr: "≈ ₹75",
    payload: { gb: 100 },
  },
  {
    id: "gb500",
    label: "+500 GB",
    headline: "Project pack",
    blurb: "Comfort headroom for stems, VFX plates and cut variants.",
    approxInr: "≈ ₹375",
    payload: { gb: 500 },
  },
  {
    id: "tb1",
    label: "+1 TB Production Vault",
    headline: "Studio vault",
    blurb: "Cinema-grade block for masters, dailies and long-form ingest.",
    approxInr: "₹767 incl. GST",
    payload: { tb: 1 },
    highlight: true,
  },
];

export function PremiumStorageTopupModal({
  open,
  onOpenChange,
  onSuccess,
  reason,
  playAlert = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  /** Contextual reason (e.g. "This 38.75 GB upload exceeds your remaining 4.2 GB."). */
  reason?: string;
  /** Play a subtle alert chime when the modal opens (default true). */
  playAlert?: boolean;
}) {
  const { user } = useAuth();
  const [pendingId, setPendingId] = useState<Tier["id"] | null>(null);

  useEffect(() => {
    if (open && playAlert) playSubtleAlert();
  }, [open, playAlert]);
  const { user } = useAuth();
  const [pendingId, setPendingId] = useState<Tier["id"] | null>(null);

  const startCheckout = useCallback(
    async (tier: Tier) => {
      if (!user) {
        toast.error("Sign in to purchase additional storage.");
        return;
      }
      setPendingId(tier.id);
      const toastId = toast.loading("Opening Razorpay…");
      try {
        assertLiveCheckoutHost();
        const { data, error } = await supabase.functions.invoke("create-storage-topup", {
          body: tier.payload,
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
          key: (data as any).keyId,
          order_id: (data as any).orderId,
          amount: (data as any).amount,
          currency: "INR",
          name: "StreamVista Storage Top-up",
          description: `${tier.label} — ${tier.headline}`,
          prefill: { email: user.email ?? undefined },
          theme: { color: "#a855f7" },
          handler: async (resp: any) => {
            const v = await supabase.functions.invoke("verify-storage-topup", {
              body: {
                topupId: (data as any).topupId,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              },
            });
            if (v.error || (v.data as any)?.error) {
              toast.error("Payment verification failed — please contact support.");
            } else {
              toast.success(`${tier.label} activated — storage unlocked.`);
              onOpenChange(false);
              onSuccess?.();
            }
          },
        });
        toast.dismiss(toastId);
        rzp.open();
      } catch (e: any) {
        toast.error(e?.message || "Could not start Razorpay checkout", { id: toastId });
      } finally {
        setPendingId(null);
      }
    },
    [user, onOpenChange, onSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-accent/40 bg-gradient-to-br from-background via-background to-primary/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-accent" /> Premium Storage Top-up
          </DialogTitle>
          <DialogDescription>
            Add cinema-grade storage to your workspace. All top-ups activate instantly after payment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {TIERS.map((t) => {
            const isPending = pendingId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => startCheckout(t)}
                disabled={pendingId !== null}
                className={cn(
                  "text-left rounded-xl border p-4 space-y-2 transition",
                  "hover:border-accent hover:bg-accent/5",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  t.highlight
                    ? "border-accent/60 bg-accent/10"
                    : "border-border/60 bg-background/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-sm">
                    <HardDrive className="w-4 h-4" /> {t.label}
                  </span>
                  {t.highlight && (
                    <span className="text-[10px] uppercase tracking-wide text-accent">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{t.headline}</p>
                <p className="text-sm">{t.blurb}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-medium">{t.approxInr}</span>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-accent/60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground pt-2">
          Payments are processed by Razorpay. Prices include 18% GST. You will receive a
          GST invoice by email after activation.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default PremiumStorageTopupModal;
