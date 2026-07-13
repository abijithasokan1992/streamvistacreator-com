import { HardDrive, Cloud, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStorage } from "@/hooks/useWorkspaceStorage";

/**
 * StorageLive — real-time storage capacity + usage panel driven exclusively
 * by the shared `useWorkspaceStorage` hook (workspace_storage_entitlements
 * for capacity + workspace_storage_usage for usage, both surfaced through
 * `get_workspace_storage_entitlement`).
 *
 * There is now ONE source of truth. Every header, card, and dashboard uses
 * this hook — no more ad-hoc queries.
 */

const GB = 1024 ** 3;

export default function StorageLive({ compact }: { compact?: boolean }) {
  const s = useWorkspaceStorage();
  const { t } = useTranslation();

  if (s.loading) {
    return <div className="rounded-xl border border-border/40 bg-background/40 h-[148px] animate-pulse" />;
  }

  const totalGb = s.totalGb;
  const usedGb  = s.usedGb;
  const pct     = s.pct;
  const remainingGb = s.remainingGb;

  if (totalGb <= 0 && s.usedBytes <= 0) {
    return (
      <EmptyCard
        icon={<HardDrive className="w-4 h-4" />}
        title={t("creator.storage.title")}
        message={t("creator.storage.empty")}
      />
    );
  }

  if (compact) {
    const barTone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-warning" : "bg-accent";
    return (
      <section className="rounded-xl border border-border/50 bg-card/40 p-5 space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/15 grid place-items-center">
              <HardDrive className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {t("creator.storage.title")}
              </p>
              <p className="text-sm font-semibold mt-0.5">
                {t("creator.storage.usedOf", { used: formatGb(usedGb), total: formatGb(totalGb) })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
            <Cloud className="w-3 h-3 text-success" />
            <span className="text-success">{s.billingStatus ?? t("creator.storage.provisioned")}</span>
            {s.planCode && <span className="text-muted-foreground">· {s.planCode}</span>}
          </div>
        </header>
        <div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full transition-[width] duration-500 ${barTone}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 tabular-nums">
            <span>{t("creator.storage.percentUsed", { pct: pct.toFixed(1) })}</span>
            <span>{t("creator.storage.remaining", { amount: formatGb(remainingGb) })}</span>
          </div>
        </div>
        {pct >= 90 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive">
              {t("creator.storage.nearlyFull")}
            </span>
          </div>
        )}
      </section>
    );
  }

  const barTone = pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-accent";

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/15 grid place-items-center">
            <HardDrive className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">
              {t("creator.storage.titleFull")}
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {t("creator.storage.usedOf", { used: formatGb(usedGb), total: formatGb(totalGb) })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <Cloud className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">{s.billingStatus ?? t("creator.storage.provisioned")}</span>
          {s.planCode && <span className="text-muted-foreground">· {s.planCode}</span>}
        </div>
      </header>
      <div>
        <div className="h-2 rounded-full bg-zinc-900 overflow-hidden">
          <div className={`h-full transition-[width] duration-500 ${barTone}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 tabular-nums">
          <span>{t("creator.storage.percentUsed", { pct: pct.toFixed(1) })}</span>
          <span>{t("creator.storage.remaining", { amount: formatGb(remainingGb) })}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label={t("creator.storage.included")}  value={fmtGbNullable(s.includedGb)} />
        <Tile label={t("creator.storage.paidAddon")} value={fmtGbNullable(s.paidGb)} />
        <Tile label={t("creator.storage.bonus")}     value={fmtGbNullable(s.bonusGb)} />
        <Tile label={t("creator.storage.archived")}  value={formatGb(s.archivedBytes / GB)} />
      </div>
      {pct >= 90 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-2.5 text-[11px] flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-red-300">
            {t("creator.storage.nearlyFull")}
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
function fmtGbNullable(v: number | null | undefined): string {
  if (v == null || v <= 0) return "—";
  return formatGb(v);
}
