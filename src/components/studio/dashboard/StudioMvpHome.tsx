/**
 * StudioMvpHome — Dashboard (workflow-first, progressive disclosure)
 *
 * Single responsibility: give the studio operator a fast at-a-glance view of
 * where their work stands and one-tap routes into the next task.
 *
 * Layout (top → bottom, priority order):
 *   1. Live sync strip — workspace data freshness + manual refresh
 *   2. Critical alert  — storage near-full (only when relevant)
 *   3. Primary actions — New Production / Continue / Upload (compact row)
 *   4. Status grid     — Productions · Storage · Recent · Plan (KPIs only)
 *   5. Recent uploads  — last 5 ingest jobs (hidden when empty)
 *
 * All wiring (create, ingest, purchase) is delegated up via props. Reuses
 * existing supabase client + design tokens; no new backend behaviour.
 */
import { useEffect, useState } from "react";
import {
  Clapperboard, UploadCloud, HardDrive, Plus, Play, ArrowRight,
  ShoppingCart, Crown, CheckCircle2, AlertTriangle, Loader2, Film, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const AUTO_REFRESH_MS = 15 * 60 * 1000;

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

function fmtUsedCapacity(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 MB";
  if (gb < 1) return `${Math.round(gb * 1024)} MB`;
  return fmtCapacity(gb);
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
  /** Fallback count; component fetches the real count when workspaceId is present. */
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
  const [prodCount, setProdCount] = useState<number>(productionCount);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  // Refresh quietly every 15 minutes and whenever the operator returns to the
  // browser tab. This prevents an old workspace snapshot from sitting on screen
  // for days while keeping the underlying queries read-only and RLS-scoped.
  useEffect(() => {
    if (!workspaceId || typeof window === "undefined") return;
    const intervalId = window.setInterval(() => setRefreshTick((n) => n + 1), AUTO_REFRESH_MS);
    const refreshOnFocus = () => setRefreshTick((n) => n + 1);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [workspaceId]);

  // Load real production count + recent ingest jobs in parallel. Read-only,
  // RLS-scoped queries against existing tables — no new backend surface.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workspaceId) {
        setJobs([]);
        setJobsLoading(false);
        setLastRefreshedAt(null);
        return;
      }
      setJobsLoading(true);
      const [{ data: jobsData }, { count }] = await Promise.all([
        supabase
          .from("ingest_jobs")
          .select("id,status,total_bytes,transferred_bytes,total_files,completed_files,created_at,source_summary,project_id")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId),
      ]);
      if (cancelled) return;
      setJobs((jobsData as JobRow[]) ?? []);
      setProdCount(count ?? productionCount);
      setLastRefreshedAt(Date.now());
      setJobsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId, productionCount, refreshTick]);

  const pct = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0;
  const nearFull = pct >= 80;
  const availableGb = Math.max(0, totalGb - usedGb);
  const storageActive = hasPaidVault || totalGb > 0;
  const refreshLabel = jobsLoading
    ? "Refreshing…"
    : lastRefreshedAt
    ? `Updated ${new Date(lastRefreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Waiting for live data";

  return (
    <div className="space-y-5">
      {/* 1. Live data strip — explicit freshness, no stale "last updated days ago" state. */}
      <section className="rounded-xl border border-border/50 bg-secondary/5 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" aria-hidden />
          <span className="text-xs font-medium">Live workspace data</span>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">Auto-refreshes every 15 min and on focus</span>
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{refreshLabel}</span>
          <button
            type="button"
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={jobsLoading || !workspaceId}
            className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/20 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
            aria-label="Refresh studio dashboard data"
          >
            <RefreshCw className={cn("w-3 h-3", jobsLoading && "animate-spin")} /> Refresh
          </button>
        </div>
      </section>

      {/* 2. Critical alert — only when it changes what the user should do next. */}
      {nearFull && storageActive && (
        <section
          role="alert"
          className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Storage {pct}% full</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtCapacity(availableGb)} remaining · add more before your next upload.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={onBuyStorage} className="bg-gradient-primary text-primary-foreground glow-primary">
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Buy Storage
          </Button>
        </section>
      )}

      {/* 3. Primary actions — the top of the funnel. Compact, one row. */}
      <section className="grid gap-2.5 sm:grid-cols-3">
        <ActionCard
          icon={<Plus className="w-4 h-4" />}
          label="New Production"
          hint="Start a new title"
          onClick={onNewProduction}
          primary
        />
        {activeProject ? (
          <ActionCard
            icon={<Play className="w-4 h-4" />}
            label="Continue"
            hint={activeProject.name}
            onClick={onContinueProduction}
          />
        ) : (
          <ActionCard
            icon={<Clapperboard className="w-4 h-4" />}
            label="Open Productions"
            hint={prodCount > 0 ? `${prodCount} on file` : "None yet"}
            onClick={onOpenProductions}
          />
        )}
        <ActionCard
          icon={<UploadCloud className="w-4 h-4" />}
          label="Upload"
          hint="Import media to vault"
          onClick={onUpload}
        />
      </section>

      {/* 4. Status grid — dense KPIs, one metric per card, no descriptions. */}
      <section className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clapperboard className="w-3.5 h-3.5" />}
          label="Productions"
          value={String(prodCount)}
          onClick={onOpenProductions}
        />
        <StatCard
          icon={<HardDrive className="w-3.5 h-3.5" />}
          label="Storage"
          value={storageActive ? `${pct}%` : "—"}
          sub={storageActive ? `${fmtUsedCapacity(usedGb)} / ${fmtCapacity(totalGb)}` : "Not activated"}
          barPct={storageActive ? pct : undefined}
          tone={nearFull ? "warn" : "ok"}
          onClick={onOpenStorage}
        />
        <StatCard
          icon={<Film className="w-3.5 h-3.5" />}
          label="Uploads"
          value={jobsLoading ? "…" : String(jobs.length)}
          sub={!jobsLoading && jobs.length ? "Last 5 jobs" : undefined}
          onClick={onUpload}
        />
        <StatCard
          icon={<Crown className="w-3.5 h-3.5" />}
          label="Plan"
          value={planLabel}
          onClick={onUpgradePlan}
        />
      </section>

      {/* 5. Recent uploads — hidden entirely when there is nothing to show. */}
      {(jobsLoading || jobs.length > 0) && (
        <section className="rounded-xl border border-border/50 bg-secondary/5">
          <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/40">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Uploads</h3>
            <button
              onClick={onUpload}
              className="text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded"
            >
              Upload →
            </button>
          </header>
          {jobsLoading ? (
            <div className="py-6 grid place-items-center text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {jobs.map((j) => {
                const p = j.total_bytes > 0 ? Math.min(100, Math.round((j.transferred_bytes / j.total_bytes) * 100)) : 0;
                const tone =
                  j.status === "completed" ? "text-emerald-300" :
                  j.status === "failed" ? "text-destructive" :
                  j.status === "paused" ? "text-amber-300" : "text-accent";
                const Icon = j.status === "completed" ? CheckCircle2 : j.status === "failed" ? AlertTriangle : UploadCloud;
                return (
                  <li key={j.id} className="px-4 py-2.5 flex items-center gap-3 min-w-0">
                    <Icon className={cn("w-4 h-4 shrink-0", tone)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{j.source_summary?.root_label ?? "Ingest"}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {j.completed_files}/{j.total_files} files · {fmtBytes(j.transferred_bytes)}
                        {j.total_bytes > 0 && ` / ${fmtBytes(j.total_bytes)}`}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline tabular-nums">
                      {j.status === "completed" ? "Done" : `${p}%`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
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
        "group rounded-xl border px-4 py-3 text-left flex items-center gap-3 transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
        primary
          ? "border-accent/40 bg-accent/10 hover:bg-accent/15"
          : "border-border/50 bg-secondary/10 hover:bg-secondary/20",
      )}
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate leading-tight">{label}</span>
        <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</span>
      </span>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function StatCard({
  icon, label, value, sub, onClick, barPct, tone,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  onClick?: () => void;
  barPct?: number;
  tone?: "ok" | "warn";
}) {
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border/50 bg-secondary/5 p-3.5 text-left",
        onClick && "hover:bg-secondary/15 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="text-accent">{icon}</span>
        <span className="uppercase tracking-wider text-[10px] font-mono">{label}</span>
      </div>
      <p className="font-display text-xl mt-1.5 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
      {typeof barPct === "number" && (
        <div className="w-full bg-secondary/30 rounded-full h-1 mt-2 overflow-hidden">
          <div
            className={cn("h-1 rounded-full transition-all", tone === "warn" ? "bg-amber-400" : "bg-accent")}
            style={{ width: `${barPct}%` }}
          />
        </div>
      )}
    </Wrapper>
  );
}
