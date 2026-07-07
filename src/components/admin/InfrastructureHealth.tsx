import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Server, Database, Cloud, Mail, Bot, Network, Globe, Clock, ListChecks, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "healthy" | "warning" | "critical" | "unknown";
type Check = {
  id: string; label: string; category: string; status: Status;
  response_ms: number | null; last_checked: string;
  last_failure: string | null; error: string | null;
  suggested_action: string | null; detail?: Record<string, any>;
};
type Report = {
  checks: Check[];
  summary: { total: number; healthy: number; warning: number; critical: number; unknown: number };
  snapshot?: any;
  generated_at: string;
};

const CATEGORY_ICON: Record<string, JSX.Element> = {
  core: <Database className="w-3.5 h-3.5" />,
  storage: <Cloud className="w-3.5 h-3.5" />,
  email: <Mail className="w-3.5 h-3.5" />,
  ai: <Bot className="w-3.5 h-3.5" />,
  queues: <ListChecks className="w-3.5 h-3.5" />,
  jobs: <Clock className="w-3.5 h-3.5" />,
  routing: <Network className="w-3.5 h-3.5" />,
};

const STATUS_ICON: Record<Status, JSX.Element> = {
  healthy: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  critical: <XCircle className="w-4 h-4 text-red-400" />,
  unknown: <HelpCircle className="w-4 h-4 text-muted-foreground" />,
};

const STATUS_TONE: Record<Status, string> = {
  healthy: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  critical: "border-red-500/30 bg-red-500/5",
  unknown: "border-border/40 bg-secondary/10",
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = Date.now() - Date.parse(iso);
  if (Number.isNaN(d)) return "—";
  const s = Math.round(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export default function InfrastructureHealth() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke<Report>("infra-health");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setReport(data as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const g: Record<string, Check[]> = {};
    (report?.checks ?? []).forEach((c) => { (g[c.category] ??= []).push(c); });
    return g;
  }, [report]);

  const overall: Status = useMemo(() => {
    if (!report) return "unknown";
    if (report.summary.critical > 0) return "critical";
    if (report.summary.warning > 0) return "warning";
    return "healthy";
  }, [report]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" /> Infrastructure Health
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live probes against every service. No cached UI state — every refresh re-runs the checks.
          </p>
        </div>
        <button
          onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border/50 hover:bg-secondary/40 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Hard refresh
        </button>
      </header>

      {report && (
        <div className={`rounded-lg border p-4 flex items-center gap-3 ${STATUS_TONE[overall]}`}>
          {STATUS_ICON[overall]}
          <div className="flex-1">
            <div className="text-sm font-semibold capitalize">Overall: {overall}</div>
            <div className="text-xs text-muted-foreground">
              {report.summary.healthy} healthy · {report.summary.warning} warning · {report.summary.critical} critical
              {report.summary.unknown ? ` · ${report.summary.unknown} unknown` : ""}
              &nbsp;·&nbsp;generated {timeAgo(report.generated_at)}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
          Failed to run probes: {error}
        </div>
      )}

      {!report && loading && (
        <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Running live probes…
        </div>
      )}

      {report && Object.entries(grouped).map(([category, list]) => (
        <section key={category} className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {CATEGORY_ICON[category] ?? <Server className="w-3.5 h-3.5" />}
            {category}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {list.map((c) => (
              <div key={c.id} className={`rounded-lg border p-3 ${STATUS_TONE[c.status]}`}>
                <div className="flex items-start gap-2">
                  {STATUS_ICON[c.status]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold">{c.label}</div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.status}</span>
                      {c.response_ms != null && (
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{c.response_ms}ms</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Last checked {timeAgo(c.last_checked)}
                      {c.last_failure && ` · last failure ${timeAgo(c.last_failure)}`}
                    </div>
                    {c.error && (
                      <div className="text-xs text-red-300 mt-1.5 font-mono break-all bg-black/20 rounded p-1.5">
                        {c.error}
                      </div>
                    )}
                    {c.suggested_action && (
                      <div className="text-xs text-foreground/90 mt-1.5 leading-relaxed">
                        <span className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Suggested action · </span>
                        {c.suggested_action}
                      </div>
                    )}
                    {c.detail && Object.keys(c.detail).length > 0 && (
                      <details className="text-[11px] text-muted-foreground mt-1">
                        <summary className="cursor-pointer hover:text-foreground">Detail</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[10px] bg-black/30 rounded p-2">
                          {JSON.stringify(c.detail, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
