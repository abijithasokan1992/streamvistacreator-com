import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Rocket, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Circle,
  Loader2, TrendingUp, ListChecks,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { newCorrelationId, correlationHeaders } from "@/lib/correlation";

type LaunchStatus = "ready" | "ready_with_warnings" | "blocked";
type Report = {
  correlation_id: string;
  generated_at: string;
  launch_status: LaunchStatus;
  overall: "healthy" | "warning" | "critical" | "unknown";
  mvp_completion: number;
  summary: {
    infra: { healthy: number; warning: number; critical: number; unknown: number };
    pillars: { passing: number; total: number };
    failed_uploads: number;
    dlq_emails: number;
    alerts_24h: number;
  };
  capabilities: Array<{ id: string; label: string; pillars: Record<string, { ok: boolean; note: string }> }>;
  risks: Array<{ id: string; severity: string; title: string; detail: string; suggested_action: string | null; category: string }>;
  blockers: Array<{ id: string; message: string; severity: "high" | "medium" }>;
  checklist: Array<{ id: string; label: string; ok: boolean; detail: string }>;
};

const LAUNCH_TONE: Record<LaunchStatus, string> = {
  ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  ready_with_warnings: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  blocked: "border-red-500/40 bg-red-500/10 text-red-200",
};
const LAUNCH_LABEL: Record<LaunchStatus, string> = {
  ready: "READY FOR LAUNCH",
  ready_with_warnings: "READY WITH WARNINGS",
  blocked: "LAUNCH BLOCKED",
};

/**
 * Executive-level production readiness dashboard. Reuses `infra-health` and
 * `platform-readiness` under the hood via a single aggregation edge function
 * so admins get one authoritative view rather than three siloed tabs.
 */
export default function ProductionReadinessReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const cid = newCorrelationId();
    try {
      const { data, error } = await supabase.functions.invoke<Report>("production-readiness-report", {
        headers: correlationHeaders(cid),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport(data as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent grid place-items-center">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold leading-tight">Production Readiness Report</h2>
            <p className="text-sm text-muted-foreground mt-1">
              One aggregated view of infra health, capability readiness, risks, blockers, and launch checklist —
              computed live from authoritative backend state.
            </p>
          </div>
        </div>
        <button
          type="button" onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-secondary/60 text-xs hover:bg-secondary disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Hard refresh
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>
      )}

      {loading && !report && (
        <div className="rounded-xl border border-border/40 p-10 grid place-items-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {report && (
        <>
          {/* Launch banner + MVP % */}
          <div className={`rounded-xl border p-5 ${LAUNCH_TONE[report.launch_status]}`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {report.launch_status === "ready" && <ShieldCheck className="w-6 h-6" />}
                {report.launch_status === "ready_with_warnings" && <AlertTriangle className="w-6 h-6" />}
                {report.launch_status === "blocked" && <XCircle className="w-6 h-6" />}
                <div>
                  <div className="text-lg font-display font-bold tracking-wide">{LAUNCH_LABEL[report.launch_status]}</div>
                  <div className="text-xs opacity-80">Generated {new Date(report.generated_at).toLocaleString()} · trace {report.correlation_id.slice(0, 8)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-display font-bold">{report.mvp_completion}%</div>
                <div className="text-[10px] uppercase tracking-wider opacity-80">MVP completion</div>
              </div>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="grid gap-3 md:grid-cols-5">
            <Tile label="Infra critical" value={report.summary.infra.critical} tone={report.summary.infra.critical ? "bad" : "good"} />
            <Tile label="Infra warnings" value={report.summary.infra.warning} tone={report.summary.infra.warning ? "warn" : "good"} />
            <Tile label="Pillars passing" value={`${report.summary.pillars.passing}/${report.summary.pillars.total}`} tone="info" />
            <Tile label="Failed uploads" value={report.summary.failed_uploads} tone={report.summary.failed_uploads > 25 ? "warn" : "good"} />
            <Tile label="Emails in DLQ" value={report.summary.dlq_emails} tone={report.summary.dlq_emails > 10 ? "warn" : "good"} />
          </div>

          {/* Blockers */}
          <Card icon={<XCircle className="w-4 h-4 text-red-400" />} title={`Open blockers (${report.blockers.length})`}>
            {report.blockers.length === 0 ? (
              <p className="text-xs text-emerald-300">No launch-blocking issues detected.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.blockers.map((b) => (
                  <li key={b.id} className="text-sm flex items-start gap-2">
                    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 ${b.severity === "high" ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"}`}>
                      {b.severity}
                    </span>
                    <span className="text-foreground/90">{b.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Risk register */}
          <Card icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} title={`Risk register (${report.risks.length})`}>
            {report.risks.length === 0 ? (
              <p className="text-xs text-emerald-300">No open risks.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {report.risks.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/40 p-2.5 bg-secondary/10">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold ${r.severity === "high" ? "text-red-300" : "text-amber-300"}`}>{r.severity}</span>
                    </div>
                    <div className="text-sm font-semibold mt-1">{r.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{r.detail}</div>
                    {r.suggested_action && (
                      <div className="text-[11px] text-foreground/80 mt-1.5">
                        <span className="text-amber-300 font-semibold">Fix: </span>{r.suggested_action}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Release checklist */}
          <Card icon={<ListChecks className="w-4 h-4 text-accent" />} title="Release checklist">
            <ul className="space-y-1.5">
              {report.checklist.map((c) => (
                <li key={c.id} className="text-sm flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className={c.ok ? "text-foreground/90" : "text-muted-foreground"}>{c.label}</div>
                    <div className="text-[11px] text-muted-foreground/80">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Capability audit */}
          <Card icon={<TrendingUp className="w-4 h-4 text-accent" />} title={`Capability audit (${report.capabilities.length})`}>
            <div className="grid gap-1.5 md:grid-cols-2">
              {report.capabilities.map((c) => {
                const passed = Object.values(c.pillars).filter((p) => p.ok).length;
                return (
                  <div key={c.id} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                    <span className="text-foreground/90">{c.label}</span>
                    <span className={`text-xs font-mono ${passed === 5 ? "text-emerald-300" : passed >= 3 ? "text-amber-300" : "text-red-300"}`}>
                      {passed}/5
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </section>
  );
}

function Tile({ label, value, tone }: { label: string; value: number | string; tone: "good" | "bad" | "warn" | "info" }) {
  const cls = {
    good: "border-emerald-500/30 bg-emerald-500/5",
    bad: "border-red-500/40 bg-red-500/10",
    warn: "border-amber-500/40 bg-amber-500/10",
    info: "border-border/40 bg-secondary/10",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-2xl font-display font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
