import { useCallback, useState } from "react";
import { PlayCircle, Loader2, CheckCircle2, XCircle, AlertTriangle, MinusCircle, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { newCorrelationId, correlationHeaders } from "@/lib/correlation";

type Outcome = "pass" | "fail" | "warn" | "skipped";
type TestResult = {
  id: string; suite: string; name: string; outcome: Outcome;
  duration_ms: number; detail: string; suggested_fix?: string | null;
};
type Response = {
  correlation_id: string;
  generated_at: string;
  duration_ms: number;
  summary: { total: number; pass: number; fail: number; warn: number; skipped: number };
  results: TestResult[];
};

const SUITES = ["all", "database", "auth", "uploads", "email", "ai", "security", "payments"] as const;
const OUTCOME_ICON: Record<Outcome, JSX.Element> = {
  pass: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  fail: <XCircle className="w-4 h-4 text-red-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  skipped: <MinusCircle className="w-4 h-4 text-muted-foreground" />,
};

/**
 * Admin Test Runner — smoke tests + integration checks against LIVE backend.
 * Reuses `admin-test-runner` edge function; no test infra duplication.
 */
export default function AdminTestRunner() {
  const [suite, setSuite] = useState<(typeof SUITES)[number]>("all");
  const [running, setRunning] = useState(false);
  const [res, setRes] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSuite = useCallback(async () => {
    setRunning(true); setError(null);
    const cid = newCorrelationId();
    try {
      const path = suite === "all" ? "admin-test-runner" : `admin-test-runner?suite=${suite}`;
      const { data, error } = await supabase.functions.invoke<Response>(path, {
        headers: correlationHeaders(cid),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRes(data as Response);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setRunning(false); }
  }, [suite]);

  const grouped = res
    ? res.results.reduce((acc, r) => { (acc[r.suite] ??= []).push(r); return acc; }, {} as Record<string, TestResult[]>)
    : {};

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-accent" /> Admin Test Runner
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Executes live smoke tests + integration checks against the running backend. Read-only where possible.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={suite} onChange={(e) => setSuite(e.target.value as any)}
            className="text-xs px-2 py-1.5 rounded-md border border-border/50 bg-background">
            {SUITES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={runSuite} disabled={running}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50">
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            Run suite
          </button>
        </div>
      </header>

      {error && <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}

      {res && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <SummaryTile label="Total" value={res.summary.total} />
            <SummaryTile label="Passed" value={res.summary.pass} tone="good" />
            <SummaryTile label="Warnings" value={res.summary.warn} tone={res.summary.warn ? "warn" : "good"} />
            <SummaryTile label="Failed" value={res.summary.fail} tone={res.summary.fail ? "bad" : "good"} />
            <SummaryTile label="Duration" value={`${res.duration_ms}ms`} />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Trace: {res.correlation_id}</span>
            <button className="inline-flex items-center gap-1 hover:text-foreground"
              onClick={() => navigator.clipboard.writeText(res.correlation_id)}>
              <Copy className="w-3 h-3" /> copy
            </button>
          </div>

          {Object.entries(grouped).map(([s, rows]) => (
            <div key={s} className="rounded-xl border border-border/40 bg-card/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{s}</div>
              <ul className="divide-y divide-border/30">
                {rows.map((r) => (
                  <li key={r.id} className="py-2 flex items-start gap-2">
                    {OUTCOME_ICON[r.outcome]}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{r.duration_ms}ms</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
                      {r.suggested_fix && (
                        <div className="text-[11px] text-foreground/80 mt-1">
                          <span className="text-amber-300 font-semibold">Fix: </span>{r.suggested_fix}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {!res && !running && (
        <div className="rounded-lg border border-border/40 p-8 text-sm text-muted-foreground text-center">
          Select a suite and press <span className="text-accent">Run suite</span> to execute live tests.
        </div>
      )}
    </section>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "bad" | "warn" }) {
  const t = tone === "bad" ? "border-red-500/40 bg-red-500/10"
    : tone === "warn" ? "border-amber-500/40 bg-amber-500/10"
    : tone === "good" ? "border-emerald-500/30 bg-emerald-500/5"
    : "border-border/40 bg-secondary/10";
  return (
    <div className={`rounded-lg border p-2.5 ${t}`}>
      <div className="text-lg font-display font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
