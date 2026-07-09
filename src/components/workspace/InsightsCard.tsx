import { useEffect, useState } from "react";
import { BarChart3, Film, Upload, Bell, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * WorkspaceInsightsCard — lightweight analytics dashboard built strictly
 * from existing tables. No fabricated metrics.
 *
 *  • Title counts + status breakdown  → content_titles
 *  • Storage occupancy                → workspace_storage_entitlements / usage
 *  • Upload activity (last 30 days)   → ingest_jobs
 *  • Recent activity feed             → notifications
 */

const GB = 1024 ** 3;

type StatusBucket = { key: string; label: string; count: number; tone: string };
type UploadDay = { label: string; count: number };
type ActivityRow = { id: string; title: string; message: string | null; created_at: string };

const STATUS_ORDER: Array<{ key: string; label: string; tone: string }> = [
  { key: "draft",                 label: "Draft",         tone: "bg-muted-foreground/40" },
  { key: "incomplete",            label: "Incomplete",    tone: "bg-warning/60" },
  { key: "submitted",             label: "Submitted",     tone: "bg-accent/60" },
  { key: "in_review",             label: "In review",     tone: "bg-accent/80" },
  { key: "qc_review",             label: "QC",            tone: "bg-accent" },
  { key: "legal_review",          label: "Legal",         tone: "bg-primary/70" },
  { key: "changes_requested",     label: "Changes",       tone: "bg-warning" },
  { key: "approved",              label: "Approved",      tone: "bg-success/70" },
  { key: "ready_for_distribution",label: "Ready",         tone: "bg-success" },
  { key: "rejected",              label: "Rejected",      tone: "bg-destructive/70" },
];

export default function WorkspaceInsightsCard() {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<StatusBucket[]>([]);
  const [totalTitles, setTotalTitles] = useState(0);
  const [usedGb, setUsedGb] = useState<number | null>(null);
  const [totalGb, setTotalGb] = useState<number | null>(null);
  const [uploads30, setUploads30] = useState(0);
  const [uploadsFailed30, setUploadsFailed30] = useState(0);
  const [dailyUploads, setDailyUploads] = useState<UploadDay[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [titles, usage, ent, jobs, notifs] = await Promise.all([
        (supabase as any)
          .from("content_titles")
          .select("status")
          .eq("owner_user_id", user.id)
          .limit(5000),
        (supabase as any)
          .from("workspace_storage_usage")
          .select("display_used_bytes, last_recalculated_at")
          .eq("user_id", user.id)
          .order("last_recalculated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("workspace_storage_entitlements")
          .select("total_storage_gb")
          .eq("user_id", user.id)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (supabase as any)
          .from("ingest_jobs")
          .select("status, created_at")
          .eq("created_by", user.id)
          .gte("created_at", since)
          .limit(2000),
        (supabase as any)
          .from("notifications")
          .select("id, title, message, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (cancelled) return;

      // ── Title status breakdown ────────────────────────────────────────────
      const rows = (titles.data ?? []) as Array<{ status: string }>;
      setTotalTitles(rows.length);
      const counts = new Map<string, number>();
      rows.forEach((r) => counts.set(r.status, (counts.get(r.status) ?? 0) + 1));
      setBuckets(
        STATUS_ORDER
          .map((s) => ({ ...s, count: counts.get(s.key) ?? 0 }))
          .filter((s) => s.count > 0)
      );

      // ── Storage occupancy ────────────────────────────────────────────────
      const usedBytes = Number(usage.data?.display_used_bytes ?? 0);
      setUsedGb(usedBytes / GB);
      setTotalGb(ent.data?.total_storage_gb != null ? Number(ent.data.total_storage_gb) : null);

      // ── Upload activity ─────────────────────────────────────────────────
      const jobRows = (jobs.data ?? []) as Array<{ status: string; created_at: string }>;
      setUploads30(jobRows.length);
      setUploadsFailed30(jobRows.filter((j) => j.status === "failed" || j.status === "error").length);

      // 14-day sparkline
      const byDay = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        byDay.set(d.toISOString().slice(0, 10), 0);
      }
      jobRows.forEach((j) => {
        const key = new Date(j.created_at).toISOString().slice(0, 10);
        if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
      });
      setDailyUploads(
        Array.from(byDay.entries()).map(([k, v]) => ({
          label: new Date(k).toLocaleDateString(undefined, { day: "numeric" }),
          count: v,
        }))
      );

      setActivity((notifs.data ?? []) as ActivityRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return <div className="rounded-2xl border border-border/40 bg-card/40 h-72 animate-pulse" />;
  }

  const storagePct = totalGb && totalGb > 0 && usedGb != null ? Math.min(100, (usedGb / totalGb) * 100) : 0;
  const uploadsMax = Math.max(1, ...dailyUploads.map((d) => d.count));

  const hasAnything = totalTitles > 0 || uploads30 > 0 || (usedGb ?? 0) > 0 || activity.length > 0;

  if (!hasAnything) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card/40 p-5 space-y-3">
        <Header />
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border/50 p-4">
          Analytics will appear as soon as you add a title, run an upload, or receive activity. Nothing to summarize yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border/50 bg-card/40 p-5 space-y-6">
      <Header />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Film} label="Titles" value={String(totalTitles)} />
        <Kpi icon={Upload} label="Uploads · 30d" value={String(uploads30)} tone={uploadsFailed30 > 0 ? "warn" : undefined} sub={uploadsFailed30 > 0 ? `${uploadsFailed30} failed` : undefined} />
        <Kpi icon={HardDrive} label="Storage used" value={usedGb != null ? formatGb(usedGb) : "—"} sub={totalGb ? `of ${formatGb(totalGb)}` : undefined} />
        <Kpi icon={Bell} label="Recent events" value={String(activity.length)} />
      </div>

      {/* Title status breakdown */}
      {buckets.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
            Titles by status
          </p>
          <div className="w-full h-3 rounded-full bg-muted/40 overflow-hidden flex">
            {buckets.map((b) => (
              <div
                key={b.key}
                className={b.tone}
                style={{ width: `${(b.count / totalTitles) * 100}%` }}
                title={`${b.label}: ${b.count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {buckets.map((b) => (
              <span key={b.key} className="inline-flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-sm ${b.tone}`} />
                {b.label} <span className="tabular-nums text-foreground/80">{b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Storage bar */}
      {usedGb != null && totalGb != null && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">Storage occupancy</span>
            <span className="text-muted-foreground tabular-nums">
              {formatGb(usedGb)} / {formatGb(totalGb)} · {storagePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={storagePct >= 90 ? "bg-destructive h-full" : storagePct >= 75 ? "bg-warning h-full" : "bg-accent h-full"}
              style={{ width: `${storagePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload activity sparkline (14 days) */}
      {dailyUploads.some((d) => d.count > 0) && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
            Uploads · last 14 days
          </p>
          <div className="flex items-end gap-1 h-16">
            {dailyUploads.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                <div
                  className="w-full rounded-t bg-accent/60 hover:bg-accent transition-colors"
                  style={{ height: `${(d.count / uploadsMax) * 100}%`, minHeight: d.count > 0 ? "3px" : "0" }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground/60">
            <span>{dailyUploads[0]?.label}</span>
            <span>{dailyUploads[dailyUploads.length - 1]?.label}</span>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {activity.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 font-semibold">
            Recent activity
          </p>
          <ul className="divide-y divide-border/40">
            {activity.map((a) => (
              <li key={a.id} className="py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-foreground truncate">{a.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {relTime(a.created_at)}
                  </span>
                </div>
                {a.message && <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{a.message}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center ring-1 ring-primary/20">
        <BarChart3 className="w-5 h-5 text-primary" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-semibold">
          Insights & Analytics
        </p>
        <h3 className="font-semibold text-lg leading-tight mt-0.5">Workspace snapshot</h3>
      </div>
    </header>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; tone?: "warn";
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-2xl font-semibold mt-1 tabular-nums leading-none">{value}</p>
      {sub && (
        <p className={`text-[10px] mt-1 ${tone === "warn" ? "text-warning" : "text-muted-foreground"}`}>{sub}</p>
      )}
    </div>
  );
}

function formatGb(gb: number): string {
  if (!Number.isFinite(gb) || gb <= 0) return "0 GB";
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  return `${gb.toFixed(gb < 10 ? 2 : 1)} GB`;
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
