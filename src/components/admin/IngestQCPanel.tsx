import { useCallback, useEffect, useState } from "react";
import {
  Activity, Loader2, PlayCircle, CheckCircle2, XCircle, PauseCircle, RefreshCw, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * IngestQCPanel
 * ─────────────
 * Real-time view over `ingest_jobs` scoped to the caller (RLS filters to the
 * user's workspace membership). Each row exposes a "Run QC Scan" trigger that
 * invokes the `run-qc-scan` edge function; the function performs the analysis
 * server-side and stamps the result onto `ingest_jobs.metadata.qc_scan_result`.
 *
 * No mocks. If the caller has no jobs, we render an honest empty state.
 */

type JobRow = {
  id: string;
  status: string;
  job_mode: string | null;
  total_files: number | null;
  completed_files: number | null;
  failed_files: number | null;
  total_bytes: number | null;
  transferred_bytes: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any> | null;
};

const STATUS_META: Record<string, { label: string; icon: any; tone: string }> = {
  pending:    { label: "Pending",    icon: PauseCircle, tone: "text-muted-foreground" },
  queued:     { label: "Queued",     icon: PauseCircle, tone: "text-muted-foreground" },
  running:    { label: "Running",    icon: Loader2,     tone: "text-accent" },
  uploading:  { label: "Uploading",  icon: Loader2,     tone: "text-accent" },
  paused:     { label: "Paused",     icon: PauseCircle, tone: "text-amber-400" },
  completed:  { label: "Completed",  icon: CheckCircle2,tone: "text-emerald-400" },
  qc_scanning:{ label: "QC scanning",icon: Loader2,     tone: "text-cyan-400" },
  qc_flagged: { label: "QC flagged", icon: XCircle,     tone: "text-amber-400" },
  qc_passed:  { label: "QC passed",  icon: CheckCircle2,tone: "text-emerald-400" },
  failed:     { label: "Failed",     icon: XCircle,     tone: "text-red-400" },
};

export default function IngestQCPanel() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await (supabase as any)
      .from("ingest_jobs")
      .select("id, status, job_mode, total_files, completed_files, failed_files, total_bytes, transferred_bytes, error_message, created_at, updated_at, metadata")
      .order("updated_at", { ascending: false })
      .limit(6);
    if (error) {
      // RLS may filter completely; treat as empty rather than erroring.
      setJobs([]);
    } else {
      setJobs((data ?? []) as JobRow[]);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Poll every 6s while at least one job is in a transient state.
  useEffect(() => {
    if (!user) return;
    const transient = jobs.some((j) =>
      ["running", "uploading", "qc_scanning", "pending", "queued"].includes(j.status)
    );
    if (!transient) return;
    const iv = window.setInterval(load, 6000);
    return () => window.clearInterval(iv);
  }, [jobs, user?.id, load]);

  const runScan = async (jobId: string) => {
    setScanning((s) => ({ ...s, [jobId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("run-qc-scan", {
        body: { ingest_job_id: jobId },
      });
      if (error) throw error;
      const result = (data as any)?.result;
      if (result?.verdict === "pass") {
        toast.success("QC scan passed — no issues detected.");
      } else if (result?.verdict === "fail") {
        toast.warning(`QC scan flagged ${result.findings?.length ?? 0} issue(s).`);
      } else {
        toast.success("QC scan completed.");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "QC scan failed");
    } finally {
      setScanning((s) => ({ ...s, [jobId]: false }));
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 h-[180px] animate-pulse" />;
  }

  return (
    <section className="rounded-xl border border-zinc-800/60 bg-zinc-950/40 p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 grid place-items-center">
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground/80 font-semibold">
              Processing
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {jobs.length === 0 ? "No files being processed" : `${jobs.length} recent file${jobs.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </header>

      {jobs.length === 0 ? (
        <div className="rounded-md border border-zinc-800/60 bg-zinc-950/60 p-4 text-xs text-muted-foreground">
          Nothing to show yet. Upload a master file to see progress and run a quality check here.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status] ?? { label: j.status, icon: Activity, tone: "text-muted-foreground" };
            const Icon = meta.icon;
            const spin = ["running", "uploading", "qc_scanning"].includes(j.status);
            const total = Number(j.total_bytes ?? 0);
            const done = Number(j.transferred_bytes ?? 0);
            const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
            const qcResult = (j.metadata as any)?.qc_scan_result as
              | { verdict: "pass" | "fail"; summary?: string; findings?: string[]; scanned_at?: string }
              | undefined;
            const canScan = ["completed", "qc_flagged", "qc_passed"].includes(j.status);
            const isScanning = scanning[j.id] || j.status === "qc_scanning";

            return (
              <li key={j.id} className="rounded-md border border-zinc-800/60 bg-zinc-950/60 p-3 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.tone}`}>
                    <Icon className={`w-3.5 h-3.5 ${spin ? "animate-spin" : ""}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {j.job_mode || "upload"} · {j.completed_files ?? 0}/{j.total_files ?? 0} files
                    {j.failed_files ? ` · ${j.failed_files} failed` : ""}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">
                    {j.id.slice(0, 8)}
                  </span>
                </div>

                {total > 0 && (
                  <div className="h-1 rounded bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {j.error_message && (
                  <p className="text-[11px] text-red-400 truncate">{j.error_message}</p>
                )}

                {qcResult && (
                  <div className={`rounded border p-2 text-[11px] ${
                    qcResult.verdict === "pass"
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/5 text-amber-300"
                  }`}>
                    <p className="font-semibold">
                      Quality check {qcResult.verdict === "pass" ? "passed" : "needs attention"}
                    </p>
                    {qcResult.summary && <p className="mt-0.5 opacity-90">{qcResult.summary}</p>}
                    {qcResult.findings && qcResult.findings.length > 0 && (
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {qcResult.findings.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <button
                    disabled={!canScan || isScanning}
                    onClick={() => runScan(j.id)}
                    className="text-[11px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-500/40 bg-cyan-500/5 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isScanning
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>
                      : <><Sparkles className="w-3 h-3" /> Run quality check</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
