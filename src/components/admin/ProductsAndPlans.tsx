import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, Loader2, Package, HardDrive } from "lucide-react";
import FreeTierConfig from "@/components/admin/FreeTierConfig";

type Plan = {
  id: string;
  name: string | null;
  price_amount?: number | null;
  currency?: string | null;
  storage_gb?: number | null;
  is_active?: boolean | null;
  billing_cycle?: string | null;
};

type Topup = { id: string; tb_added: number | null; amount_inr: number | null; status: string | null; created_at: string };

export default function ProductsAndPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [topups, setTopups] = useState<Topup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, t] = await Promise.all([
        supabase.from("plans").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("storage_topups").select("*").order("created_at", { ascending: false }).limit(25),
      ]);
      setPlans((p.data as Plan[]) ?? []);
      setTopups((t.data as Topup[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Plans (read-only)</h2>
        </div>
        {loading ? (
          <div className="py-8 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Cycle</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Storage</th>
                  <th className="py-2 pr-4">Active</th>
                </tr>
              </thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.id} className="border-b border-border/20">
                    <td className="py-2 pr-4 font-medium">{p.name ?? p.id}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{p.billing_cycle ?? "—"}</td>
                    <td className="py-2 pr-4 font-mono">{p.price_amount != null ? `${p.currency ?? "₹"}${p.price_amount}` : "—"}</td>
                    <td className="py-2 pr-4">{p.storage_gb != null ? `${p.storage_gb} GB` : "—"}</td>
                    <td className="py-2 pr-4">{p.is_active ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Storage Top-ups (read-only)</h2>
        </div>
        {topups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No storage top-ups recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Storage</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {topups.map(t => (
                  <tr key={t.id} className="border-b border-border/20">
                    <td className="py-2 pr-4">{new Date(t.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{t.tb_added != null ? `${t.tb_added} TB` : "—"}</td>
                    <td className="py-2 pr-4 font-mono">{t.amount_inr != null ? `₹${t.amount_inr}` : "—"}</td>
                    <td className="py-2 pr-4">{t.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Boxes className="w-5 h-5 text-accent" />
          <h2 className="font-display text-xl font-bold">Free Tier & Entitlements</h2>
        </div>
        <FreeTierConfig />
      </div>
    </div>
  );
}
