import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import BuyVaultDialog from "@/components/studio/vault/BuyVaultDialog";
import { useLiveStudioSku } from "./useLiveStudioSku";

/**
 * One-click 1 TB Storage purchase card.
 * Reuses the existing BuyVaultDialog + Razorpay verification flow.
 * Mounted on both Studio Home and Creator Delivery Vault.
 */
export default function Buy1TBCard({
  variant = "primary",
  headline,
  subline,
  onPurchased,
}: {
  variant?: "primary" | "compact";
  headline?: string;
  subline?: string;
  onPurchased?: () => void;
}) {
  const product = useLiveStudioSku();
  const [open, setOpen] = useState(false);
  if (!product) return null;

  const gstMul = 1 + (product.gst_percent ?? 18) / 100;
  const totalRupees = Math.round((product.sell_price_per_tb_paise / 100) * gstMul);
  const baseRupees = Math.round(product.sell_price_per_tb_paise / 100);

  const title = headline ?? "1 TB Storage";
  const sub = subline ?? "Secure recurring storage for masters, delivery files and archive copies.";

  if (variant === "compact") {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm">{title} · ₹{totalRupees}/month</p>
          <p className="text-[11px] text-muted-foreground">₹{baseRupees} + {product.gst_percent}% GST · recurring monthly</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="bg-gradient-primary text-primary-foreground">
          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Buy 1 TB
        </Button>
        <BuyVaultDialog
          product={product}
          open={open}
          onOpenChange={setOpen}
          onPurchased={() => { setOpen(false); onPurchased?.(); }}
        />
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 to-secondary/10 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <span className="text-[11px] uppercase tracking-[0.25em] text-accent font-mono">One-click purchase</span>
          <h3 className="font-display text-2xl mt-1.5">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>
          <p className="text-sm mt-3">
            <span className="font-display text-2xl">₹{totalRupees}</span>
            <span className="text-muted-foreground"> / month</span>
            <span className="text-xs text-muted-foreground ml-2">(₹{baseRupees} + {product.gst_percent}% GST)</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Billed monthly. Storage activates immediately after successful payment.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="bg-gradient-primary text-primary-foreground glow-primary"
        >
          <ShoppingCart className="w-4 h-4 mr-2" /> Buy 1 TB Now
        </Button>
      </div>
      <BuyVaultDialog
        product={product}
        open={open}
        onOpenChange={setOpen}
        onPurchased={() => { setOpen(false); onPurchased?.(); }}
      />
    </section>
  );
}
