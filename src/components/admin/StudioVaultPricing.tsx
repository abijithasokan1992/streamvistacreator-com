import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Package, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { fmtINR, VaultProduct, STORAGE_CLASS_META } from "@/lib/studioVault";

type EditState = Partial<VaultProduct> & { id: string };

export default function StudioVaultPricing() {
  const [rows, setRows] = useState<VaultProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    // Read via the public view — the base table is service_role-only.
    const { data } = await supabase
      .from("studio_vault_products_public" as any)
      .select("*")
      .order("sort_order", { ascending: true });
    setRows((data as unknown as VaultProduct[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("studio_vault_upsert_product", {
        _payload: JSON.parse(JSON.stringify(editing)),
      });
      if (error) throw error;
      toast.success("Vault product saved");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: VaultProduct, field: "visible" | "self_serve_enabled", val: boolean) => {
    const { error } = await supabase.rpc("studio_vault_upsert_product", {
      _payload: { id: p.id, [field]: val } as never,
    });
    if (error) toast.error(error.message);
    else { toast.success("Updated"); await load(); }
  };

  if (loading) {
    return <div className="glass rounded-2xl p-6 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-5 h-5 text-accent" />
        <h2 className="font-display text-xl font-bold">Studio Vault Pricing & Products</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Self-serve storage products shown on the Studio dashboard. Prices are per TB per month, ex-GST.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-xs uppercase tracking-widest text-muted-foreground">
            <tr className="text-left">
              <th className="py-2 pr-3">Product</th>
              <th className="py-2 pr-3">Class</th>
              <th className="py-2 pr-3">Sell / TB</th>
              <th className="py-2 pr-3">Cost / TB</th>
              <th className="py-2 pr-3">Margin</th>
              <th className="py-2 pr-3">Visible</th>
              <th className="py-2 pr-3">Self-serve</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((p) => {
              const margin = p.sell_price_per_tb_paise - p.internal_cost_per_tb_paise;
              const marginPct = p.sell_price_per_tb_paise > 0
                ? Math.round((margin / p.sell_price_per_tb_paise) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.code} · {p.badge ?? "—"}</div>
                  </td>
                  <td className="py-2 pr-3"><span className={STORAGE_CLASS_META[p.storage_class].tone}>{STORAGE_CLASS_META[p.storage_class].label}</span></td>
                  <td className="py-2 pr-3 font-mono">{fmtINR(p.sell_price_per_tb_paise)}</td>
                  <td className="py-2 pr-3 font-mono text-muted-foreground">{fmtINR(p.internal_cost_per_tb_paise)}</td>
                  <td className="py-2 pr-3 font-mono">
                    <span className={marginPct >= 50 ? "text-emerald-300" : marginPct >= 25 ? "text-amber-300" : "text-destructive"}>
                      {fmtINR(margin)} <span className="text-[11px]">({marginPct}%)</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3"><Switch checked={p.visible} onCheckedChange={(v) => toggle(p, "visible", v)} /></td>
                  <td className="py-2 pr-3"><Switch checked={p.self_serve_enabled} onCheckedChange={(v) => toggle(p, "self_serve_enabled", v)} /></td>
                  <td className="py-2 pr-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, name: p.name, sell_price_per_tb_paise: p.sell_price_per_tb_paise, internal_cost_per_tb_paise: p.internal_cost_per_tb_paise, min_tb: p.min_tb, max_tb: p.max_tb, badge: p.badge ?? "", sort_order: p.sort_order, default_tb_options: p.default_tb_options })}>
                      <Pencil className="w-4 h-4 mr-1.5" /> Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="mt-6 rounded-xl border border-accent/30 bg-secondary/10 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Edit: {editing.name}</h3>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">
              <span className="text-muted-foreground">Display name</span>
              <input className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Badge</span>
              <input className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm" value={(editing.badge as string) ?? ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Sell price / TB (paise)</span>
              <input type="number" className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm font-mono" value={editing.sell_price_per_tb_paise ?? 0} onChange={(e) => setEditing({ ...editing, sell_price_per_tb_paise: Number(e.target.value) })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Internal cost / TB (paise)</span>
              <input type="number" className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm font-mono" value={editing.internal_cost_per_tb_paise ?? 0} onChange={(e) => setEditing({ ...editing, internal_cost_per_tb_paise: Number(e.target.value) })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Min TB</span>
              <input type="number" className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm" value={editing.min_tb ?? 1} onChange={(e) => setEditing({ ...editing, min_tb: Number(e.target.value) })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Max TB</span>
              <input type="number" className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm" value={editing.max_tb ?? 200} onChange={(e) => setEditing({ ...editing, max_tb: Number(e.target.value) })} />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Sort order</span>
              <input type="number" className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm" value={editing.sort_order ?? 100} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
            </label>
            <label className="text-xs sm:col-span-2">
              <span className="text-muted-foreground">Default TB options (comma-separated)</span>
              <input className="w-full mt-1 px-3 py-1.5 rounded-lg bg-background border border-border/50 text-sm font-mono" value={(editing.default_tb_options ?? []).join(",")} onChange={(e) => setEditing({ ...editing, default_tb_options: e.target.value.split(",").map((x) => Number(x.trim())).filter((x) => x > 0) })} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
