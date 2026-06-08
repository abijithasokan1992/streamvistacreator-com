import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FreeTierRow {
  id: string;
  label: string;
  storage_gb: number;
  duration_days: number;
  amount: number;
  currency: string;
  notes: string | null;
  is_active: boolean;
  updated_at: string;
}

export default function FreeTierConfig() {
  const [row, setRow] = useState<FreeTierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("free_tier_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRow(data as FreeTierRow | null);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase
      .from("free_tier_config")
      .update({
        label: row.label,
        storage_gb: row.storage_gb,
        duration_days: row.duration_days,
        amount: row.amount,
        currency: row.currency,
        notes: row.notes,
        is_active: row.is_active,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Free Tier updated · applies to all new sign-ups");
    load();
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-display text-xl font-bold">Default Free Tier · New Sign-ups</h2>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-accent/10 text-accent border border-accent/30">
              <Lock className="w-3 h-3" /> Admin only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Every new sign-up is auto-activated on this plan. Edit the units, duration, and amount below — changes take effect immediately for future activations.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : !row ? (
        <p className="text-sm text-muted-foreground">No Free Tier configuration found.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Plan Label">
              <input value={row.label} onChange={e => setRow({ ...row, label: e.target.value })}
                className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border text-sm" />
            </Field>
            <Field label="Storage (GB)">
              <input type="number" min={0} step="0.1" value={row.storage_gb}
                onChange={e => setRow({ ...row, storage_gb: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border text-sm" />
            </Field>
            <Field label="Duration (days)">
              <input type="number" min={1} value={row.duration_days}
                onChange={e => setRow({ ...row, duration_days: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border text-sm" />
            </Field>
            <Field label={`Amount (${row.currency})`}>
              <input type="number" min={0} step="1" value={row.amount}
                onChange={e => setRow({ ...row, amount: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-md bg-secondary/50 border border-border text-sm" />
            </Field>
          </div>

          <Field label="Internal notes (visible to admins only)">
            <textarea value={row.notes ?? ""} rows={2}
              onChange={e => setRow({ ...row, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-border text-sm" />
          </Field>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-border/50">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={row.is_active}
                onChange={e => setRow({ ...row, is_active: e.target.checked })} />
              Active (auto-assign to new sign-ups)
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">Updated {new Date(row.updated_at).toLocaleString()}</span>
              <button onClick={save} disabled={saving}
                className="h-10 px-4 rounded-md bg-gradient-primary text-primary-foreground text-sm font-semibold glow-primary disabled:opacity-60 flex items-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Free Tier
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
