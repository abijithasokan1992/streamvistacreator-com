import { useEffect, useState } from "react";
import { HardDrive, Cloud, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";

/**
 * StorageLive — real-time storage capacity + usage panel driven exclusively
 * by `workspace_storage_entitlements` (capacity) and `workspace_storage_usage`
 * (bytes used). Nothing hardcoded. Empty rows render an honest empty state.
 *
 * Scope resolution:
 *  - Prefer the active workspace when available.
 *  - Fall back to any entitlement/usage row keyed by the caller's user_id
 *    (RLS scopes this to the caller automatically).
 */

const GB = 1024 ** 3;

type Row = {
  totalGb: number | null;
  includedGb: number | null;
  paidGb: number | null;
  bonusGb: number | null;
  usedBytes: number;
  activeBytes: number;
  archivedBytes: number;
  billingStatus: string | null;
  planCode: string | null;
  lastRecalculatedAt: string | null;
};

export default function StorageLive({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const { activeId } = useWorkspaces();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Entitlement lookup: workspace first, then user-owned row.
      let ent: any = null;
      if (activeId) {
        const r = await (supabase as any)
          .from("workspace_storage_entitlements")
          .select("total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status, plan_code")
          .eq("workspace_id", activeId)
          .maybeSingle();
        ent = r.data;
      }
      if (!ent) {
        const r = await (supabase as any)
          .from("workspace_storage_entitlements")
          .select("total_storage_gb, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, billing_status, plan_code, workspace_id")
          .eq("user_id", user.id)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle();
        ent = r.data;
      }

      let usage: any = null;
      if (activeId) {
        const r = await (supabase as any)
          .from("workspace_storage_usage")
          .select("display_used_bytes, active_bytes, archived_bytes, last_recalculated_at")
          .eq("workspace_id", activeId)
          .maybeSingle();
        usage = r.data;
      }
      if (!usage) {
        const r = await (supabase as any)
          .from("workspace_storage_usage")
          .select("display_used_bytes, active_bytes, archived_bytes, last_recalculated_at")
          .eq("user_id", user.id)
          .order("last_recalculated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        usage = r.data;
      }

      if (cancelled) return;

      if (!ent && !usage) {
        setRow(null);
        setLoading(false);
        return;
      }

      setRow({
        totalGb: ent?.total_storage_gb != null ? Number(ent.total_storage_gb) : null,
        includedGb: ent?.included_storage_gb != null ? Number(ent.included_storage_gb) : null,
        paidGb: ent?.paid_storage_gb != null ? Number(ent.paid_storage_gb) : null,
        bonusGb: ent?.admin_bonus_storage_gb != null ? Number(ent.admin_bonus_storage_gb) : null,
        usedBytes: Number(usage?.display_used_bytes ?? 0),
        activeBytes: Number(usage?.active_bytes ?? 0),
        archivedBytes: Number(usage?.archived_bytes ?? 0),
        billingStatus: ent?.billing_status ?? null,
        planCode: ent?.plan_code ?? null,
        lastRecalculatedAt: usage?.last_recalculated_at ?? null,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, activeId]);

  if (loading) {
    return <div className="rounded-xl border border-border/40 bg-background/40 h-[148px] animate-pulse" />;
  }

  if (!row) {
    return (
      <EmptyCard
        icon={<HardDrive className="w-4 h-4" />}
        title="Storage"
        message="No storage data found yet. Your capacity and usage will appear once your workspace is provisioned."
      />
    );
  }

  const usedGb = row.usedBytes / GB;
  const totalGb = row.totalGb ?? 0;
  const pct = totalGb > 0 ? Math.min(100, (usedGb / totalGb) * 100) : 0;
  const remainingGb = Math.max(0, totalGb - usedGb);

  if (compact) {
    const barTone =
      pct >= 90 ? "bg-destructive"
      : pct >= 75 ? "bg-warning"
      : "bg-accent";

    return (
      <section className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/15 grid place-items-center">
              <HardDrive className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                Cloud Storage
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {formatGb(usedGb)} of {formatGb(totalGb)} used
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
            <Cloud className="w-3 h-3 text-success" />
            <span className="text-success">{row.billingStatus ?? "provisioned"}</span>
            {row.planCode && (
              <span className="text-muted-foreground">· {row.planCode}</span>
            )}
          </div>
        </header>

        <div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full transition-[width] duration-500 ${barTone}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 tabular-nums">
            <span>{pct.toFixed(1)}% used</span>
            <span>{formatGb(remainingGb)} remaining</span>
          </div>
        </div>

        {pct >= 90 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive">
              Storage is nearly full. Add capacity from Storage &amp; Billing to keep uploads running.
            </span>
          </div>
        )}
      </section>
    );
  }

  const barTone =
    pct >= 90 ? "bg-red-500"
    : pct >= 75 ? "bg-amber-400"
    : "bg-accent";

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 grid place-items-center">
            <HardDrive className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">
              StreamVista Cloud X · Storage
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {formatGb(usedGb)} of {formatGb(totalGb)} used
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <Cloud className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">{row.billingStatus ?? "provisioned"}</span>
          {row.planCode && (
            <span className="text-muted-foreground">· {row.planCode}</span>
          )}
        </div>
      </header>

      <div>
        <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-500 ${barTone}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 tabular-nums">
          <span>{pct.toFixed(1)}% used</span>
          <span>{formatGb(remainingGb)} remaining</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Included" value={fmtGbNullable(row.includedGb)} />
        <Tile label="Paid add-on" value={fmtGbNullable(row.paidGb)} />
        <Tile label="Bonus" value={fmtGbNullable(row.bonusGb)} />
        <Tile label="Archived" value={formatGb(row.archivedBytes / GB)} />
      </div>

      {pct >= 90 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300">
            Storage is nearly full. Add capacity from Storage &amp; Billing to keep uploads running.
          </span>
        </div>
      )}
    </section>
  );
}

function EmptyCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 grid place-items-center text-muted-foreground">{icon}</div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground">{message}</p>
    </section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800/50 bg-zinc-950/50 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function formatGb(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`;
}
function fmtGbNullable(v: number | null): string {
  if (v == null) return "—";
  return formatGb(v);
}
