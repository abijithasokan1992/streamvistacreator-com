import { useEffect, useMemo, useState } from "react";
import { Loader2, BarChart3, RefreshCw, UploadCloud, Wallet, Scale, Send, Sparkles, Zap, TrendingUp, ArrowUpDown } from "lucide-react";
import { ROI_ESTIMATE_LABEL, ROI_ESTIMATE_RANK, SUBLICENSABLE_LABEL, type RoiEstimate, type SublicensableStatus } from "@/lib/creator/titleSchema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

/**
 * Business Intelligence Hub — Admin extension over existing operational tables.
 *
 * NO new tables. Reuses:
 *   • ingest_jobs / ingest_job_items / ingest_telemetry   (Upload Analytics)
 *   • revenue_lines / royalty_allocations / invoices      (Revenue Analytics)
 *   • title_rights_availability / license_contracts       (Rights Analytics)
 *   • distribution_deliveries / distribution_queue        (Delivery Analytics)
 *   • email_send_log / admin_infra_snapshot RPC           (AI Insights)
 *   • existing edge functions (admin-metrics, handle_global_platform_maintenance)
 *
 * Read-only surface. Actions delegate to existing endpoints — no duplicated logic.
 */

type Snapshot = {
  uploads: { total: number; completed: number; failed: number; in_progress: number };
  revenue_last30_inr: number;
  revenue_lines: number;
  rights_active: number;
  rights_expiring_30d: number;
  deliveries_ok: number;
  deliveries_failed: number;
  emails_failed: number;
  latency_avg_ms: number | null;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);

const SINCE_30D = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

export default function BusinessIntelligenceHub() {
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [running, setRunning] = useState(false);
  const [maintenance, setMaintenance] = useState<Record<string, unknown> | null>(null);

  const reload = async () => {
    setLoading(true);
    const since = SINCE_30D();
    const in30d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const [jobs, telem, revLines, rightsActive, rightsExp, deliveriesOk, deliveriesFail, emailsFail] = await Promise.all([
      (supabase as any).from("ingest_job_items").select("status").gte("created_at", since).limit(5000),
      (supabase as any).from("ingest_telemetry").select("duration_ms").gte("created_at", since).not("duration_ms","is",null).limit(5000),
      (supabase as any).from("revenue_lines").select("gross_paise,net_paise,occurred_on").gte("occurred_on", since.slice(0, 10)),
      (supabase as any).from("title_rights_availability").select("id", { count: "exact", head: true }).eq("status", "available"),
      (supabase as any).from("title_rights_availability").select("id", { count: "exact", head: true })
        .lte("available_until", in30d).gte("available_until", new Date().toISOString()),
      (supabase as any).from("distribution_deliveries").select("id", { count: "exact", head: true }).eq("status", "ok").gte("created_at", since),
      (supabase as any).from("distribution_deliveries").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
      (supabase as any).from("email_send_log").select("id", { count: "exact", head: true }).in("status", ["dlq","failed"]).gte("created_at", since),
    ]);

    const items = (jobs.data ?? []) as { status: string }[];
    const durations = ((telem.data ?? []) as { duration_ms: number }[])
      .map((r) => Number(r.duration_ms)).filter((n) => Number.isFinite(n));
    const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    const revNetInr = ((revLines.data ?? []) as any[])
      .reduce((s, r) => s + Number(r.net_paise ?? r.gross_paise ?? 0), 0) / 100;

    setSnap({
      uploads: {
        total: items.length,
        completed: items.filter((i) => i.status === "completed" || i.status === "succeeded").length,
        failed: items.filter((i) => i.status === "failed").length,
        in_progress: items.filter((i) => i.status === "pending" || i.status === "in_progress").length,
      },
      revenue_last30_inr: revNetInr,
      revenue_lines: (revLines.data ?? []).length,
      rights_active: (rightsActive as any).count ?? 0,
      rights_expiring_30d: (rightsExp as any).count ?? 0,
      deliveries_ok: (deliveriesOk as any).count ?? 0,
      deliveries_failed: (deliveriesFail as any).count ?? 0,
      emails_failed: (emailsFail as any).count ?? 0,
      latency_avg_ms: avg,
    });
    setLoading(false);
  };
  useEffect(() => { void reload(); }, []);

  const insights = useMemo<string[]>(() => {
    if (!snap) return [];
    const out: string[] = [];
    const total = snap.uploads.total || 1;
    const failRate = (snap.uploads.failed / total) * 100;
    if (failRate > 5) out.push(`Upload failure rate is ${failRate.toFixed(1)}% (last 30d) — above the 5% threshold.`);
    else out.push(`Upload pipeline is healthy at ${failRate.toFixed(1)}% failure rate.`);
    if (snap.emails_failed > 0) out.push(`${snap.emails_failed} outbound emails failed — investigate SMTP / DLQ.`);
    if (snap.deliveries_failed > snap.deliveries_ok * 0.1) out.push(`Distribution failure rate is elevated (${snap.deliveries_failed} vs ${snap.deliveries_ok} ok).`);
    if (snap.rights_expiring_30d > 0) out.push(`${snap.rights_expiring_30d} rights windows expire within 30 days — schedule renewals.`);
    if (snap.latency_avg_ms && snap.latency_avg_ms > 4000) out.push(`Average upload stage latency is ${snap.latency_avg_ms}ms — consider region tuning.`);
    if (snap.revenue_last30_inr > 0) out.push(`Recognised revenue in the last 30 days: ${fmtINR(snap.revenue_last30_inr)} across ${snap.revenue_lines} lines.`);
    return out;
  }, [snap]);

  const runMaintenance = async () => {
    setRunning(true);
    try {
      const { data, error } = await (supabase as any).rpc("handle_global_platform_maintenance");
      if (error) throw error;
      setMaintenance(data ?? { ok: true });
      await reload();
    } catch (e: any) {
      setMaintenance({ error: e?.message ?? String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="glass-strong rounded-3xl border border-border/50 p-6 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary grid place-items-center glow-primary">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Business Reports</h3>
            <p className="text-xs text-muted-foreground">
              Cross-domain analytics over uploads, revenue, rights and delivery. Reads live from existing tables — no duplicated data.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </header>

      {loading || !snap ? (
        <div className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading intelligence…
        </div>
      ) : (
        <Tabs defaultValue="uploads" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1.5 h-auto p-1.5 glass rounded-2xl bg-transparent border border-border/50 w-full">
            <TabsTrigger value="uploads"><UploadCloud className="w-3.5 h-3.5 mr-1" />Uploads</TabsTrigger>
            <TabsTrigger value="revenue"><Wallet className="w-3.5 h-3.5 mr-1" />Revenue</TabsTrigger>
            <TabsTrigger value="rights"><Scale className="w-3.5 h-3.5 mr-1" />Rights</TabsTrigger>
            <TabsTrigger value="delivery"><Send className="w-3.5 h-3.5 mr-1" />Delivery</TabsTrigger>
            <TabsTrigger value="market"><TrendingUp className="w-3.5 h-3.5 mr-1" />Market Potential</TabsTrigger>
            <TabsTrigger value="insights"><Sparkles className="w-3.5 h-3.5 mr-1" />AI Insights</TabsTrigger>
            <TabsTrigger value="automation"><Zap className="w-3.5 h-3.5 mr-1" />Automation</TabsTrigger>
          </TabsList>

          <TabsContent value="uploads" className="mt-5">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Stat label="Total (30d)" value={String(snap.uploads.total)} />
              <Stat label="Completed" value={String(snap.uploads.completed)} tone="ok" />
              <Stat label="Failed" value={String(snap.uploads.failed)} tone="warn" />
              <Stat label="In progress" value={String(snap.uploads.in_progress)} tone="primary" />
              <Stat label="Avg latency" value={snap.latency_avg_ms == null ? "—" : `${snap.latency_avg_ms} ms`} />
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="mt-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Recognised (30d)" value={fmtINR(snap.revenue_last30_inr)} tone="ok" />
              <Stat label="Revenue lines" value={String(snap.revenue_lines)} />
              <Stat label="Failed emails (30d)" value={String(snap.emails_failed)} tone={snap.emails_failed > 0 ? "warn" : "muted"} />
            </div>
          </TabsContent>

          <TabsContent value="rights" className="mt-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Active windows" value={String(snap.rights_active)} tone="ok" />
              <Stat label="Expiring · 30d" value={String(snap.rights_expiring_30d)} tone={snap.rights_expiring_30d > 0 ? "warn" : "muted"} />
              <Stat label="Contracts" value="live" tone="primary" />
            </div>
          </TabsContent>

          <TabsContent value="delivery" className="mt-5">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Delivered (30d)" value={String(snap.deliveries_ok)} tone="ok" />
              <Stat label="Failed (30d)" value={String(snap.deliveries_failed)} tone={snap.deliveries_failed > 0 ? "warn" : "muted"} />
              <Stat label="Success rate" value={
                `${((snap.deliveries_ok / Math.max(1, snap.deliveries_ok + snap.deliveries_failed)) * 100).toFixed(1)}%`
              } />
            </div>
          </TabsContent>

          <TabsContent value="market" className="mt-5">
            <MarketPotentialTable />
          </TabsContent>



          <TabsContent value="insights" className="mt-5 space-y-2">
            {insights.map((i, k) => (
              <div key={k} className="rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3 text-sm flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{i}</span>
              </div>
            ))}
            {insights.length === 0 && <div className="text-sm text-muted-foreground italic">No insights available.</div>}
            <p className="text-[11px] text-muted-foreground italic pt-2">
              Insights are rule-based summaries computed from the same tables shown above.
            </p>
          </TabsContent>

          <TabsContent value="automation" className="mt-5 space-y-3">
            <div className="rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">Global Platform Maintenance</div>
                  <p className="text-xs text-muted-foreground">
                    Retries failed uploads and emails, and reassigns unassigned reviews.
                  </p>
                </div>
                <Button size="sm" onClick={runMaintenance} disabled={running}>
                  {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />} Run
                </Button>
              </div>
              {maintenance && (
                <pre className="mt-3 text-[11px] font-mono bg-background/60 rounded-lg border border-border/50 p-3 overflow-auto max-h-64">
                  {JSON.stringify(maintenance, null, 2)}
                </pre>
              )}
            </div>
            <div className="rounded-2xl border border-border/40 bg-secondary/10 p-4 text-xs text-muted-foreground">
              Additional automations (retry-failed-uploads, retry-failed-emails) are wired as edge functions and can be invoked from Cloud → Failed Uploads and Platform → Email Log.
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "primary"|"warn"|"ok"|"muted" }) {
  const toneCls =
    tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "warn"  ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
    : tone === "ok"    ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-300"
    : "border-border/60 bg-secondary/30 text-muted-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${toneCls}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-1 text-xl font-display font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

/* -----------------------------------------------------------------------
 * MarketPotentialTable — ranks content_titles by BI signals stored in the
 * metadata JSON (roi_estimate, rights_expiry_date, sublicensable_status,
 * target_audience, platform_affinity_tags). Read-only, no new tables.
 * -------------------------------------------------------------------- */

type MarketRow = {
  id: string;
  title: string;
  status: string;
  roi: RoiEstimate;
  roiRank: number;
  expiry: string; // ISO date or ""
  expiryTs: number; // for sorting; +Inf when unset
  sublicensable: SublicensableStatus;
  audience: string;
  platforms: string[];
};

type SortKey = "roi" | "expiry" | "title" | "status";

function MarketPotentialTable() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("roi");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      setError(null);
      const { data, error } = await (supabase as any)
        .from("content_titles")
        .select("id, title, status, metadata, updated_at")
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) { setError(error.message); setRows([]); return; }
      const mapped: MarketRow[] = (data ?? []).map((r: any) => {
        const m = r.metadata ?? {};
        const c = m.commercial ?? {};
        const p = m.performance ?? {};
        const roi: RoiEstimate = (p.roi_estimate as RoiEstimate) ?? "unspecified";
        const expiry: string = c.rights_expiry_date ?? "";
        const expiryTs = expiry ? Date.parse(expiry) : Number.POSITIVE_INFINITY;
        return {
          id: r.id,
          title: r.title ?? "(untitled)",
          status: r.status ?? "",
          roi,
          roiRank: ROI_ESTIMATE_RANK[roi] ?? 0,
          expiry,
          expiryTs: Number.isFinite(expiryTs) ? expiryTs : Number.POSITIVE_INFINITY,
          sublicensable: (c.sublicensable_status as SublicensableStatus) ?? "unspecified",
          audience: c.target_audience ?? "",
          platforms: Array.isArray(p.platform_affinity_tags) ? p.platform_affinity_tags : [],
        };
      });
      setRows(mapped);
    })();
  }, []);

  const sorted = useMemo(() => {
    if (!rows) return [];
    const arr = [...rows];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "roi") cmp = a.roiRank - b.roiRank;
      else if (sortKey === "expiry") cmp = a.expiryTs - b.expiryTs;
      else if (sortKey === "title") cmp = a.title.localeCompare(b.title);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      return cmp * dir;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "title" || k === "status" ? "asc" : "desc"); }
  };

  if (rows === null) {
    return <div className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading titles…</div>;
  }
  if (error) return <div className="text-sm text-amber-300">Failed to load: {error}</div>;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground italic">No titles yet.</div>;

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="text-left font-semibold px-3 py-2">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "opacity-100" : "opacity-30"}`} />
      </button>
    </th>
  );

  return (
    <div className="rounded-2xl border border-border/50 overflow-hidden">
      <div className="px-4 py-2 text-[11px] text-muted-foreground bg-secondary/20 border-b border-border/40">
        Ranking {sorted.length} title{sorted.length === 1 ? "" : "s"} by BI signals captured in the intake form.
      </div>
      <div className="overflow-x-auto max-h-[520px]">
        <table className="w-full text-xs">
          <thead className="bg-secondary/30 text-muted-foreground sticky top-0">
            <tr>
              <Th k="title" label="Title" />
              <Th k="status" label="Status" />
              <Th k="roi" label="ROI estimate" />
              <Th k="expiry" label="Rights expiry" />
              <th className="text-left font-semibold px-3 py-2">Sublicensable</th>
              <th className="text-left font-semibold px-3 py-2">Target audience</th>
              <th className="text-left font-semibold px-3 py-2">Platform affinity</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-border/30 hover:bg-secondary/10">
                <td className="px-3 py-2 font-medium text-foreground truncate max-w-[240px]">{r.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.status || "—"}</td>
                <td className="px-3 py-2">
                  <span className={
                    r.roi === "very_high" ? "text-emerald-300"
                    : r.roi === "high" ? "text-emerald-200"
                    : r.roi === "medium" ? "text-amber-200"
                    : r.roi === "low" ? "text-muted-foreground"
                    : "text-muted-foreground italic"
                  }>
                    {ROI_ESTIMATE_LABEL[r.roi]}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">{r.expiry || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2">{SUBLICENSABLE_LABEL[r.sublicensable]}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]" title={r.audience}>{r.audience || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]" title={r.platforms.join(", ")}>
                  {r.platforms.length ? r.platforms.join(", ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
