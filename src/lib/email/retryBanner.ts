/**
 * Pure classification for the "Email retry audit" banner. Extracted so the
 * five reliability states are unit-testable without mounting the React panel.
 *
 * States (mutually exclusive):
 *   - passed         : sweep OK and post-run audit shows zero stuck message_ids
 *   - stuck          : sweep ran, audit reported pending_remaining > 0
 *   - degraded_audit : sweep OK, but the audit probe or its persistence failed
 *   - stuck_and_degraded : both stuck rows AND audit degradation
 *   - sweep_failed   : the sweep itself failed (queue drain crashed)
 *   - unauthorized   : caller lacks admin/cron authorization (HTTP 403)
 */
export type RetryBannerState =
  | "passed"
  | "stuck"
  | "degraded_audit"
  | "stuck_and_degraded"
  | "sweep_failed"
  | "unauthorized";

export interface RetryAuditRowDetails {
  audit?: { passed: boolean; pending_remaining: number; error?: string };
  audit_persist_error?: string | null;
  sweep_status?: "ok" | "degraded" | "failed";
  http_status?: number;
}

export function classifyRetryBanner(d: RetryAuditRowDetails | null | undefined): RetryBannerState {
  if (!d) return "degraded_audit";
  if (d.http_status === 403) return "unauthorized";
  if (d.sweep_status === "failed") return "sweep_failed";
  const auditDegraded = !!d.audit_persist_error || !!d.audit?.error || !d.audit;
  const stuck = !!d.audit && d.audit.passed !== true && (d.audit.pending_remaining ?? 0) > 0;
  if (stuck && auditDegraded) return "stuck_and_degraded";
  if (stuck) return "stuck";
  if (auditDegraded) return "degraded_audit";
  return "passed";
}
