import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fmtINR, STORAGE_CLASS_META, VaultProduct } from "@/lib/studioVault";
import BuyVaultDialog from "./BuyVaultDialog";

export default function VaultPlanCards({ onPurchased }: { onPurchased?: () => void }) {
  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<VaultProduct | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("studio_vault_products_public" as any)
      .select("*")
      .eq("visible", true)
      .order("sort_order", { ascending: true });
    setProducts(((data as unknown as VaultProduct[]) ?? []).map((p) => ({
      ...p,
      default_tb_options: Array.isArray(p.default_tb_options) ? p.default_tb_options : [1, 5, 12, 25, 50],
      billing_modes: Array.isArray(p.billing_modes) ? p.billing_modes : ["monthly", "quarterly", "semiannual", "annual"],
      features: Array.isArray(p.features) ? p.features : [],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="rounded-2xl border border-border/40 p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {products.map((p) => {
          const meta = STORAGE_CLASS_META[p.storage_class];
          return (
            <div key={p.id} className={`rounded-2xl border bg-gradient-to-b p-6 flex flex-col ${meta.accent}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] uppercase tracking-widest font-mono ${meta.tone}`}>{meta.label}</span>
                {p.badge && <span className="rounded-full bg-accent/15 text-accent text-[10px] px-2 py-0.5 uppercase tracking-widest">{p.badge}</span>}
              </div>
              <h3 className="font-display text-xl mt-1">{p.name}</h3>
              <p className="text-xs text-muted-foreground mt-1 min-h-[3em]">{p.short_pitch || p.description}</p>
              <div className="my-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold">{fmtINR(p.sell_price_per_tb_paise)}</span>
                  <span className="text-xs text-muted-foreground">/ TB / month</span>
                </div>
                <p className="text-[11px] text-muted-foreground">ex-GST · annual saves 12%</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 mb-5 flex-1">
                {(p.features ?? []).slice(0, 5).map((f, i) => (
                  <li key={i} className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />{f}</li>
                ))}
              </ul>
              <Button
                onClick={() => { setActive(p); setOpen(true); }}
                disabled={!p.self_serve_enabled}
                className="bg-gradient-primary text-primary-foreground glow-primary"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {p.self_serve_enabled ? "Configure & Buy" : "Contact sales"}
              </Button>
            </div>
          );
        })}
      </div>
      <BuyVaultDialog product={active} open={open} onOpenChange={setOpen} onPurchased={onPurchased} />
    </>
  );
}
