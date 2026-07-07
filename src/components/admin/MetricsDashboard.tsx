import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Gauge, Mail, Upload, CreditCard, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { newCorrelationId, correlationHeaders } from "@/lib/correlation";

type Latency = { count: number; p50: number | null; p95: number | null; p99: number | null; avg: number | null };
type Metrics = {
  correlation_id: string;
  window_hours: number;
  generated_at: string;
  email: { total: number; sent: number; failed: number; suppressed: number; pending: number };
  uploads: { total: number; completed: number; failed: number; in_progress: number };
  upload_latency_ms: Latency;
  upload_stage_latency_ms: Array<{ stage: string } & Latency>;
  payments: { total: number; captured: number; failed: number };
  webhook_latency_ms: Latency;
  ingest_jobs_total: number;
  throughput: {
    uploads_per_hour: Array<{ hour: string; n: number }>;
    emails_per_hour: Array<{ hour: string; n: number }>;
  };
};

const WINDOWS = [
  { h: 1, label: "1h" },
  { h: 24, label: "24h" },
  { h: 168, label: "7d" },
];

/**
 * Metrics dashboard: latency percentiles, throughput, failure rates, retries.
 * All numbers computed live from authoritative DB tables via `admin-metrics`.
 */
export default function MetricsDashboard() {
  const [windowH, setWindowH] = useState(24);
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const cid = newCorrelationId();
    try {
      const { data: res, error } = await supabase.functions.invoke<Metrics>(
        `admin-metrics?window=${windowH}`,
        { headers: correlationHeaders(cid) },
      );
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setData(res as Metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [windowH]);

  useEffect(() => { load(); }, [load]);

  const rate = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <Gauge className="w-5 h-5 text-accent" /> Metrics & Observability
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Latency percentiles, throughput and failure rates — computed live from database aggregates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/50 overflow-hidden">
            {WINDOWS.map((w) => (
              <button key={w.h} onClick={() => setWindowH(w.h)}
                className={`text-xs px-2.5 py-1.5 ${w.h === windowH ? "bg-accent/20 text-accent" : "text-muted-foreground hover:bg-secondary/40"}`}>
                {w.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/50 hover:bg-secondary/40 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
      {loading && !data && (
        <div className="rounded-lg border border-border/40 p-8 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel icon={<Upload className="w-4 h-4 text-accent" />} title="Uploads">
            <Row label="Total" value={data.uploads.total} />
            <Row label="Completed" value={data.uploads.completed} tone="good" />
            <Row label="Failed" value={data.uploads.failed} tone={data.uploads.failed > 0 ? "bad" : "good"} />
            <Row label="Failure rate" value={`${rate(data.uploads.failed, data.uploads.total)}%`}
                 tone={rate(data.uploads.failed, data.uploads.total) > 5 ? "bad" : "good"} />
            <LatencyRow lat={data.upload_latency_ms} />
            {data.upload_stage_latency_ms.length > 0 && (
              <details className="mt-2 text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">By stage</summary>
                <div className="mt-1 space-y-0.5 font-mono">
                  {data.upload_stage_latency_ms.map((s) => (
                    <div key={s.stage} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{s.stage}</span>
                      <span>{s.count}× · p50 {s.p50 ?? "—"} · p95 {s.p95 ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Panel>

          <Panel icon={<Mail className="w-4 h-4 text-accent" />} title="Emails (deduped by message_id)">
            <Row label="Total" value={data.email.total} />
            <Row label="Sent" value={data.email.sent} tone="good" />
            <Row label="Failed / DLQ" value={data.email.failed} tone={data.email.failed > 0 ? "bad" : "good"} />
            <Row label="Suppressed" value={data.email.suppressed} tone={data.email.suppressed > 0 ? "warn" : "good"} />
            <Row label="Pending" value={data.email.pending} />
            <Row label="Failure rate" value={`${rate(data.email.failed, data.email.total)}%`}
                 tone={rate(data.email.failed, data.email.total) > 2 ? "bad" : "good"} />
          </Panel>

          <Panel icon={<CreditCard className="w-4 h-4 text-accent" />} title="Payments">
            <Row label="Total" value={data.payments.total} />
            <Row label="Captured" value={data.payments.captured} tone="good" />
            <Row label="Failed" value={data.payments.failed} tone={data.payments.failed > 0 ? "bad" : "good"} />
            <Row label="Failure rate" value={`${rate(data.payments.failed, data.payments.total)}%`}
                 tone={rate(data.payments.failed, data.payments.total) > 3 ? "bad" : "good"} />
          </Panel>

          <Panel icon={<Webhook className="w-4 h-4 text-accent" />} title="Razorpay webhook latency">
            <LatencyRow lat={data.webhook_latency_ms} />
            <Row label="Ingest jobs (window)" value={data.ingest_jobs_total} />
          </Panel>

          <Panel icon={<Upload className="w-4 h-4 text-accent" />} title="Upload throughput / hour" wide>
            <Sparkline series={data.throughput.uploads_per_hour} />
          </Panel>
          <Panel icon={<Mail className="w-4 h-4 text-accent" />} title="Email throughput / hour" wide>
            <Sparkline series={data.throughput.emails_per_hour} />
          </Panel>
        </div>
      )}
    </section>
  );
}

function Panel({ icon, title, children, wide }: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl border border-border/40 bg-card/40 p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-3">{icon}<h3 className="text-sm font-semibold">{title}</h3></div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "bad" | "warn" }) {
  const t = tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : tone === "good" ? "text-emerald-300" : "text-foreground/90";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${t}`}>{value}</span>
    </div>
  );
}

function LatencyRow({ lat }: { lat: { count: number; p50: number | null; p95: number | null; p99: number | null; avg: number | null } }) {
  if (!lat || lat.count === 0) {
    return <div className="text-xs text-muted-foreground">No latency samples in window.</div>;
  }
  return (
    <div className="text-[11px] font-mono mt-1 grid grid-cols-4 gap-1">
      <Stat label="avg" v={lat.avg} />
      <Stat label="p50" v={lat.p50} />
      <Stat label="p95" v={lat.p95} />
      <Stat label="p99" v={lat.p99} />
    </div>
  );
}
function Stat({ label, v }: { label: string; v: number | null }) {
  return (
    <div className="rounded bg-secondary/20 px-2 py-1 flex flex-col">
      <span className="text-muted-foreground text-[9px] uppercase">{label}</span>
      <span>{v ?? "—"}{v != null ? "ms" : ""}</span>
    </div>
  );
}

function Sparkline({ series }: { series: Array<{ hour: string; n: number }> }) {
  if (series.length === 0) return <p className="text-xs text-muted-foreground">No data.</p>;
  const max = Math.max(...series.map((s) => s.n), 1);
  return (
    <div className="flex items-end gap-1 h-24 mt-1">
      {series.map((s) => (
        <div key={s.hour} className="flex-1 bg-accent/40 rounded-sm hover:bg-accent transition-colors relative group"
             style={{ height: `${(s.n / max) * 100}%`, minHeight: 2 }}>
          <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap bg-background border border-border/40 rounded px-1 py-0.5">
            {s.hour.slice(11)}h · {s.n}
          </div>
        </div>
      ))}
    </div>
  );
}
