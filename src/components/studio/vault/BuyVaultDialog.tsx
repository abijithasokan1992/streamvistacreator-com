import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Sparkles, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computePricePreview, fmtINR, fmtINRDecimal, INTERVAL_OPTIONS, IntervalMonths, STORAGE_CLASS_META, VaultProduct } from "@/lib/studioVault";

function loadRazorpay(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
}

type Props = {
  product: VaultProduct | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPurchased?: () => void;
};

export default function BuyVaultDialog({ product, open, onOpenChange, onPurchased }: Props) {
  const { user } = useAuth();
  const meta = product ? STORAGE_CLASS_META[product.storage_class] : null;
  const [tb, setTb] = useState<number>(product?.default_tb_options?.[0] ?? 1);
  const [customTb, setCustomTb] = useState<number | "">("");
  const [months, setMonths] = useState<IntervalMonths>(1);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (product) {
      setTb(product.default_tb_options?.[0] ?? product.min_tb ?? 1);
      setCustomTb("");
      setMonths(1);
    }
  }, [product?.id]);

  const effectiveTb = customTb === "" ? tb : Math.max(product?.min_tb ?? 1, Math.min(product?.max_tb ?? 500, Number(customTb)));
  const priced = useMemo(() => {
    if (!product) return null;
    return computePricePreview(product, effectiveTb, months);
  }, [product, effectiveTb, months]);

  if (!product || !meta) return null;

  const buy = async () => {
    if (!user) { toast.error("Sign in to purchase"); return; }
    setPaying(true);
    const t = toast.loading("Preparing secure checkout…");
    try {
      const { data, error } = await supabase.functions.invoke("create-vault-purchase", {
        body: { productId: product.id, tb: effectiveTb, months },
      });
      if (error) throw error;
      const d = data as { topupId: string; orderId: string; amount: number; keyId: string; error?: string };
      if (d.error) throw new Error(d.error);

      await loadRazorpay();
      const rzp = new (window as unknown as { Razorpay: new (opts: unknown) => { open: () => void } }).Razorpay({
        key: d.keyId,
        order_id: d.orderId,
        amount: d.amount,
        currency: "INR",
        name: "StreamVista Studio Vault",
        description: `${product.name} · ${effectiveTb} TB · ${months}mo`,
        prefill: { email: user.email },
        theme: { color: "#a855f7" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const v = await supabase.functions.invoke("verify-storage-topup", {
            body: {
              topupId: d.topupId,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
          });
          const ve = (v.data as { error?: string } | null)?.error;
          if (v.error || ve) {
            toast.error(`Payment verification failed${ve ? ` — ${ve}` : ""}`);
          } else {
            toast.success(`${product.name} activated — ${effectiveTb} TB added to your vault.`);
            onOpenChange(false);
            onPurchased?.();
          }
        },
      });
      toast.dismiss(t);
      rzp.open();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout";
      toast.error(msg, { id: t });
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className={`w-5 h-5 ${meta.tone}`} />
            Buy {product.name}
          </DialogTitle>
          <DialogDescription>{meta.tagline}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Storage size</div>
            <div className="flex flex-wrap gap-2">
              {(product.default_tb_options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { setTb(opt); setCustomTb(""); }}
                  className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                    customTb === "" && tb === opt
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt} TB
                </button>
              ))}
              <input
                type="number"
                min={product.min_tb}
                max={product.max_tb}
                placeholder="Custom TB"
                value={customTb}
                onChange={(e) => setCustomTb(e.target.value === "" ? "" : Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-border/50 bg-transparent text-sm w-28 focus:border-accent outline-none"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Allowed range: {product.min_tb}–{product.max_tb} TB
            </p>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Billing duration</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setMonths(opt.months)}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                    months === opt.months
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{opt.discountPct ? `${opt.discountPct}% off` : "Base price"}</div>
                </button>
              ))}
            </div>
          </div>

          {priced && (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{effectiveTb} TB × {months} month{months > 1 ? "s" : ""} @ {fmtINR(product.sell_price_per_tb_paise)}/TB/mo</span>
                <span>{fmtINR(product.sell_price_per_tb_paise * effectiveTb * months)}</span>
              </div>
              {priced.discount > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>Duration discount</span>
                  <span>−{priced.discount}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{fmtINRDecimal(priced.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST ({product.gst_percent}%)</span>
                <span>{fmtINRDecimal(priced.gst)}</span>
              </div>
              <div className="border-t border-border/40 pt-2 flex justify-between items-baseline">
                <span className="font-semibold">Total payable now</span>
                <span className="font-display text-xl">{fmtINRDecimal(priced.total)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Storage is added to your vault immediately after payment. Renewal in {months} month{months > 1 ? "s" : ""}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={buy} disabled={paying || !priced} className="bg-gradient-primary text-primary-foreground glow-primary">
            {paying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
            Pay {priced ? fmtINRDecimal(priced.total) : ""}
          </Button>
        </DialogFooter>
        <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1 -mt-1">
          <ShieldCheck className="w-3 h-3" /> Secured by Razorpay · Invoice issued automatically
        </p>
      </DialogContent>
    </Dialog>
  );
}
