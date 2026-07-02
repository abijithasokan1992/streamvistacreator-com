import { useState } from "react";
import { Globe, Loader2, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PADDLE_ENABLED } from "@/lib/paddle";
import { cn } from "@/lib/utils";

/**
 * GlobalCheckout — international, self-serve USD checkout via Paddle.
 *
 * This block is additive to the existing INR/Razorpay rail. It exposes the
 * four Paddle catalog items (storage block, Creator Pro, Creator Studio,
 * one-time title license) so customers outside India can buy without a
 * founder-assisted conversation.
 *
 * Business logic on purchase / cancel / change is handled server-side by
 * `supabase/functions/payments-webhook` writing to `public.subscriptions`.
 */

type Item = {
  priceId: string;
  name: string;
  blurb: string;
  price: string;
  cadence: string;
  selectableQty?: { min: number; max: number };
};

const ITEMS: Item[] = [
  {
    priceId: "sv_storage_block_1tb_monthly",
    name: "1 TB Storage Block",
    blurb:
      "Self-serve recurring storage. Stack multiple blocks for more capacity, cancel any block at end of cycle.",
    price: "$12",
    cadence: "/TB · month",
    selectableQty: { min: 1, max: 10 },
  },
  {
    priceId: "sv_creator_pro_monthly",
    name: "Creator Pro",
    blurb:
      "Up to 10 active titles, priority review, named contact, bundled workspace storage.",
    price: "$49",
    cadence: "/month",
  },
  {
    priceId: "sv_creator_studio_monthly",
    name: "Creator Studio",
    blurb:
      "Unlimited active titles, expedited review, dedicated workspace operator, bundled storage.",
    price: "$199",
    cadence: "/month",
  },
  {
    priceId: "sv_title_license_onetime",
    name: "Title License Unlock",
    blurb:
      "One-time unlock for an extra active title without changing your plan.",
    price: "$29",
    cadence: "one-time",
  },
];

export function GlobalCheckout() {
  const { openCheckout, loading } = usePaddleCheckout();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  if (!PADDLE_ENABLED) return null;

  const handleBuy = async (item: Item) => {
    setError(null);
    setActiveId(item.priceId);
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        navigate(
          `/auth?intent=signup&redirect=${encodeURIComponent("/pricing#global-checkout")}`,
        );
        return;
      }
      await openCheckout({
        priceId: item.priceId,
        quantity: qty[item.priceId] ?? 1,
        customerEmail: user.email ?? undefined,
        customData: { userId: user.id },
        successUrl: `${window.location.origin}/?checkout=success`,
      });
    } catch (e: any) {
      setError(e?.message ?? "Checkout failed to open. Please try again.");
    } finally {
      setActiveId(null);
    }
  };

  return (
    <section
      id="global-checkout"
      className="mt-10 rounded-2xl border border-border/60 bg-card/40 p-6 md:p-8 animate-fade-in"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-4 h-4 text-accent" />
            <span className="font-mono-tech text-[10px] uppercase tracking-[0.3em] text-accent">
              International · Self-serve · USD
            </span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-black tracking-tight">
            Global checkout
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed mt-2">
            Buy storage, Creator plans, or a one-time title unlock in USD.
            Powered by our payments provider — VAT/sales tax handled automatically.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border/60 border border-border/60 rounded-xl overflow-hidden">
        {ITEMS.map((item) => {
          const busy = loading && activeId === item.priceId;
          return (
            <div
              key={item.priceId}
              className="bg-card p-5 flex flex-col gap-3 min-h-[260px]"
            >
              <div className="font-display text-base font-bold">{item.name}</div>
              <div className="flex items-baseline gap-1">
                <span className="stat-bold text-3xl">{item.price}</span>
                <span className="font-mono-tech text-[10px] uppercase tracking-widest text-text-tertiary">
                  {item.cadence}
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed flex-1">
                {item.blurb}
              </p>

              {item.selectableQty && (
                <label className="flex items-center justify-between text-[11px] text-text-tertiary uppercase tracking-wider">
                  <span>Blocks</span>
                  <input
                    type="number"
                    min={item.selectableQty.min}
                    max={item.selectableQty.max}
                    value={qty[item.priceId] ?? 1}
                    onChange={(e) =>
                      setQty((q) => ({
                        ...q,
                        [item.priceId]: Math.max(
                          item.selectableQty!.min,
                          Math.min(item.selectableQty!.max, Number(e.target.value) || 1),
                        ),
                      }))
                    }
                    className="w-14 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-sm text-foreground"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => handleBuy(item)}
                disabled={busy}
                className={cn(
                  "h-10 inline-flex items-center justify-center gap-2 rounded-md text-xs font-bold uppercase tracking-[0.18em] btn-emboss disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening…
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Buy now
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-xs text-destructive">{error}</p>
      )}
      <p className="mt-4 text-[11px] text-text-tertiary">
        You'll be asked to sign in if you aren't already. Subscriptions renew
        automatically; cancellations take effect at the end of the current
        billing cycle and files are never auto-deleted.
      </p>
    </section>
  );
}
