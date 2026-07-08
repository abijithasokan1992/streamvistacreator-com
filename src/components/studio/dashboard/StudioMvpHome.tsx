/**
 * StudioMvpHome — minimal, revenue-focused Studio dashboard.
 *
 * Shows only:
 *   1. Active Productions (count + continue)
 *   2. Storage Usage (used / total, near-full upgrade card at 80%+)
 *   3. Recent Uploads (last few ingest jobs)
 *   4. Current Plan
 *
 * Primary actions: New Production, Continue Production, Upload Files.
 * Revenue actions: Buy Storage, Upgrade Plan.
 *
 * All wiring (creation, ingest, purchase) is delegated up via props so
 * this component adds no new backend behaviour.
 */
import { useEffect, useState } from "react";
import {
  Clapperboard, UploadCloud, HardDrive, Plus, Play, ArrowRight,
  ShoppingCart, Crown, CheckCircle2, AlertTriangle, Loader2, Film,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getProductionNumber } from "@/lib/productionNumber";

type ActiveProject = { id: string; name: string; crew?: any } | null;

type JobRow = {
  id: string;
  status: string;
  total_bytes: number;
  transferred_bytes: number;
  total_files: number;
  completed_files: number;
  created_at: string;
  source_summary: any;
  project_id?: string | null;
};

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  if (n < 1099511627776) return `${(n / 1073741824).toFixed(2)} GB`;
  return `${(n / 1099511627776).toFixed(2)} TB`;
}

function fmtCapacity(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
  return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(0)} GB`;
}

export default function StudioMvpHome({
  workspaceId,
  activeProject,
  productionCount,
  totalGb,
  usedGb,
  hasPaidVault,
  planLabel,
  onNewProduction,
  onContinueProduction,
  onUpload,
  onBuyStorage,
  onUpgradePlan,
  onOpenProductions,
  onOpenStorage,
}: {
  workspaceId: string | null;
  activeProject: ActiveProject;
  productionCount: number;
  totalGb: number;
  usedGb: number;
  hasPaidVault: boolean;
  planLabel: string;
  onNewProduction: () => void;
  onContinueProduction: () => void;
  onUpload: () => void;
  onBuyStorage: () => void;
  onUpgradePlan: () => void;
  onOpenProductions: () => void;
  onOpenStorage: () => void;
}) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workspaceId) { setJobs([]); setJobsLoading(false); return; }
      setJobsLoading(true);
      const { data } = await supabase
        .from("ingest_jobs")
        .select("id,status,total_bytes,transferred_bytes,total_files,completed_files,created_at,source_summary,project_id")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled) return;
      setJobs((data as JobRow[]) ?? []);
      setJobsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const pct = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0;
  const nearFull = pct >= 80;
  const availableGb = Math.max(0, totalGb - usedGb);

  return (
    <div className="space-y-6">
      {/* Storage near-full upgrade banner */}
      {nearFull && hasPaidVault && (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-sm">Storage {pct}% full</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Only {fmtCapacity(availableGb)} left. Add more before your next upload.
              </p>
            </div>
          </div>
          <Button onClick={onBuyStorage} className="bg-gradient-primary text-primary-foreground glow-primary">
            <ShoppingCart className="w-4 h-4 mr-2" /> Buy Storage
          </Button>
        </section>
      )}

      {/* Primary actions row */}
      <section className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          icon={<Plus className="w-4 h-4" />}
          label="New Production"
          hint="Start a new title"
          onClick={onNewProduction}
          primary
        />
        <ActionCard
          icon={<Play className="w-4 h-4" />}
          label={activeProject ? "Continue Production" : "Open Productions"}
          hint={activeProject ? activeProject.name : "No active production"}
          onClick={activeProject ? onContinueProduction : onOpenProductions}
        />
        <ActionCard
          icon={<UploadCloud className="w-4 h-4" />}
          label="Upload Files"
          hint="Import media into vault"
          onClick={onUpload}
        />
      </section>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clapperboard className="w-4 h-4 text-accent" />}
          label="Active Productions"
          value={String(productionCount)}
          action={{ label: "View all", onClick: onOpenProductions }}
        />
        <StatCard
          icon={<HardDrive className="w-4 h-4 text-accent" />}
          label="Storage Usage"
          value={hasPaidVault || totalGb > 0 ? `${pct}%` : "—"}
          sub={
            hasPaidVault || totalGb > 0
              ? `${usedGb.toFixed(1)} / ${fmtCapacity(totalGb)}`
              : "Not activated"
          }
          barPct={hasPaidVault || totalGb > 0 ? pct : undefined}
          tone={nearFull ? "warn" : "ok"}
          action={{ label: "Manage", onClick: onOpenStorage }}
        />
        <StatCard
          icon={<Film className="w-4 h-4 text-accent" />}
          label="Recent Uploads"
          value={jobsLoading ? "…" : String(jobs.length)}
          sub={jobsLoading ? "" : jobs.length ? "Last 5 jobs" : "No uploads yet"}
        />
        <StatCard
          icon={<Crown className="w-4 h-4 text-accent" />}
          label="Current Plan"
          value={planLabel}
          action={{ label: "Upgrade", onClick: onUpgradePlan }}
        />
      </section>

      {/* Recent uploads list */}
      <section className="rounded-2xl border border-border/50 bg-secondary/5">
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-border/40">
          <h3 className="text-sm font-semibold">Recent Uploads</h3>
          <button
            onClick={onUpload}
            className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
          >
            Upload files →
          </button>
        </header>
        {jobsLoading ? (
          <div className="py-8 grid place-items-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No uploads yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {jobs.map((j) => {
              const pct = j.total_bytes > 0 ? Math.min(100, Math.round((j.transferred_bytes / j.total_bytes) * 100)) : 0;
              const tone =
                j.status === "completed" ? "text-emerald-300" :
                j.status === "failed" ? "text-destructive" :
                j.status === "paused" ? "text-amber-300" : "text-accent";
              const Icon = j.status === "completed" ? CheckCircle2 : j.status === "failed" ? AlertTriangle : UploadCloud;
              return (
                <li key={j.id} className="px-5 py-3 flex items-center gap-3 min-w-0">
                  <Icon className={cn("w-4 h-4 shrink-0", tone)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{j.source_summary?.root_label ?? "Ingest"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {j.completed_files}/{j.total_files} files · {fmtBytes(j.transferred_bytes)}
                      {j.total_bytes > 0 && ` / ${fmtBytes(j.total_bytes)}`}
                      {" · "}{new Date(j.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                    {j.status === "completed" ? "Done" : `${pct}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  icon, label, hint, onClick, primary,
}: {
  icon: React.ReactNode; label: string; hint: string;
  onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left flex items-center gap-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
        primary
          ? "border-accent/40 bg-accent/10 hover:bg-accent/15"
          : "border-border/50 bg-secondary/10 hover:bg-secondary/20",
      )}
    >
      <span className={cn("shrink-0", primary ? "text-accent" : "text-accent")}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5 truncate">{hint}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function StatCard({
  icon, label, value, sub, action, barPct, tone,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  action?: { label: string; onClick: () => void };
  barPct?: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/5 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wider text-[10px] font-mono">{label}</span>
      </div>
      <p className="font-display text-2xl mt-2">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>}
      {typeof barPct === "number" && (
        <div className="w-full bg-secondary/30 rounded-full h-1 mt-2 overflow-hidden">
          <div
            className={cn("h-1 rounded-full transition-all", tone === "warn" ? "bg-amber-400" : "bg-accent")}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
        >
          {action.label} →
        </button>
      )}
    </div>
  );
}
