import { useEffect, useState } from "react";
import { Database, HardDrive, Loader2, Snowflake, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { STORAGE_CLASS_META, StorageClass } from "@/lib/studioVault";

type Row = { id: string; allocated_gb: number; used_gb: number; source: string };

const classFromSource = (src: string): StorageClass | null => {
  if (src === "studio_vault_active_vault") return "active_vault";
  if (src === "studio_vault_catalog_vault") return "catalog_vault";
  if (src === "studio_vault_archive_vault") return "archive_vault";
  return null;
};

export default function MyVaultSummary() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("storage_allocations")
        .select("id,allocated_gb,used_gb,source")
        .eq("user_id", user.id)
        .like("source", "studio_vault%");
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [user?.id]);

  if (loading) return <div className="rounded-xl border border-border/40 p-4 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-accent" /></div>;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-6 text-center">
        <Database className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
        <h3 className="font-semibold text-sm">No active vault yet</h3>
        <p className="text-xs text-muted-foreground mt-1">Pick a storage class below to launch your Studio Vault.</p>
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => {
      const cls = classFromSource(r.source);
      if (!cls) return acc;
      acc[cls] = (acc[cls] || { allocated: 0, used: 0 });
      acc[cls].allocated += r.allocated_gb;
      acc[cls].used += r.used_gb;
      return acc;
    },
    {} as Record<StorageClass, { allocated: number; used: number }>,
  );

  const totalAllocGb = Object.values(totals).reduce((s, v) => s + v.allocated, 0);
  const totalUsedGb = Object.values(totals).reduce((s, v) => s + v.used, 0);
  const totalPct = totalAllocGb ? Math.round((totalUsedGb / totalAllocGb) * 100) : 0;

  const classIcon: Record<StorageClass, JSX.Element> = {
    active_vault: <Sparkles className="w-4 h-4" />,
    catalog_vault: <HardDrive className="w-4 h-4" />,
    archive_vault: <Snowflake className="w-4 h-4" />,
  };

  const barColor = (pct: number) =>
    pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-accent";

  return (
    <div className="rounded-xl border border-border/50 bg-secondary/10 p-4">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-lg">My Vault</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">
              Paid storage
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {(totalUsedGb / 1024).toFixed(2)} / {(totalAllocGb / 1024).toFixed(1)} TB used · {((totalAllocGb - totalUsedGb) / 1024).toFixed(1)} TB available
          </p>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">{totalPct}% full</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["active_vault", "catalog_vault", "archive_vault"] as StorageClass[]).map((cls) => {
          const meta = STORAGE_CLASS_META[cls];
          const v = totals[cls] || { allocated: 0, used: 0 };
          const pct = v.allocated ? Math.min(100, Math.round((v.used / v.allocated) * 100)) : 0;
          return (
            <div key={cls} className={`rounded-xl border bg-gradient-to-b p-3 ${meta.accent}`}>
              <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-mono ${meta.tone}`}>
                {classIcon[cls]} {meta.label}
              </div>
              <div className="mt-1.5 font-display text-2xl">
                {(v.allocated / 1024).toFixed(1)} <span className="text-sm text-muted-foreground">TB</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-border/40 overflow-hidden">
                <div className={`h-full transition-all ${barColor(pct)}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">{(v.used / 1024).toFixed(2)} TB used · {pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
