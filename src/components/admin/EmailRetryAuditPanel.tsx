import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, RefreshCw, Loader2, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin Email Retry Audit panel.
 *
 * Reads recent `admin_audit_log` rows where `action = 'email_retry_audit'`.
 * Each row was persisted by the `retry-failed-emails` edge function at the
 * end of a sweep and records whether the post-run audit passed and how many
 * pending rows remained.
 */

type AuditRow = {
  id: string;
  created_at: string;
  details: {
    audit?: { passed: boolean; pending_remaining: number; error?: string };
    audit_persist_error?: string;
    reconciled?: { scanned: number; closed: number; error?: string };
    summary?: Record<string, { requeued: number; skipped: number; error?: string }>;
    ran_at?: string;
  } | null;
};

export default function EmailRetryAuditPanel() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("admin_audit_log")
      .select("id, created_at, details")
      .eq("action", "email_retry_audit")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    setRows((data as AuditRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const { error } = await supabase.functions.invoke("retry-failed-emails", { body: {} });
      if (error) throw error;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Email retry audit history</h3>
          <p className="text-xs text-muted-foreground">
            Post-run audit results from the <code>retry-failed-emails</code> sweeper. A passing
            audit asserts <code>email_send_log</code> has zero <code>pending</code> rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60 disabled:opacity-60"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            Run sweeper now
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs font-medium hover:bg-secondary/60 disabled:opacity-60"
            aria-label="Refresh audit history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="rounded-md border border-border/40 bg-secondary/20 px-3 py-6 text-center text-xs text-muted-foreground">
          No audit runs recorded yet. Trigger the sweeper to persist the first entry.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((row) => {
          const audit = row.details?.audit;
          const reconciled = row.details?.reconciled;
          const summary = row.details?.summary ?? {};
          const persistError = row.details?.audit_persist_error;
          // Distinct semantics:
          //  - stuckMessages: queue still has pending rows after the sweep
          //  - auditPersistFailed: audit itself couldn't be written / probed
          const auditPresent = !!audit;
          const stuckMessages = auditPresent && audit!.passed !== true;
          const pending = audit?.pending_remaining ?? 0;
          const auditPersistFailed = !!persistError || !!audit?.error;
          const overallPassed = auditPresent && audit!.passed === true && !auditPersistFailed;
          const badge = overallPassed
            ? { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300", label: "Passed", Icon: CheckCircle2 }
            : stuckMessages
              ? { cls: "border-red-500/30 bg-red-500/15 text-red-300", label: `Stuck (${pending})`, Icon: XCircle }
              : { cls: "border-amber-500/30 bg-amber-500/15 text-amber-300", label: "Audit degraded", Icon: XCircle };
          const BadgeIcon = badge.Icon;
          return (
            <li
              key={row.id}
              className="rounded-md border border-border/50 bg-secondary/20 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${badge.cls}`}>
                    <BadgeIcon className="w-3 h-3" /> {badge.label}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
                <span className="tabular-nums text-muted-foreground">
                  pending remaining:{" "}
                  <strong className={stuckMessages ? "text-red-300" : "text-emerald-300"}>{pending}</strong>
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
                {Object.entries(summary).map(([queue, s]) => (
                  <span key={queue}>
                    {queue}: requeued {s.requeued} · skipped {s.skipped}
                    {s.error ? ` · err` : ""}
                  </span>
                ))}
                {reconciled && (
                  <span>
                    reconciled: {reconciled.closed}/{reconciled.scanned}
                  </span>
                )}
              </div>
              {audit?.error && (
                <p className="mt-1 text-[11px] text-amber-300">audit probe error: {audit.error}</p>
              )}
              {persistError && (
                <p className="mt-1 text-[11px] text-amber-300">audit persistence failed: {persistError}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
