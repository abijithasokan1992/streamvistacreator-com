// Auto-retry sweeper for failed emails.
//
// Reclaims DLQ messages for both pgmq queues (`auth_emails` and
// `transactional_emails`), moves them back to the main queue with an
// incremented attempt counter (max 3 auto-retries), and marks
// `email_send_log` accordingly.
//
// Called from pg_cron every 5 minutes. `process-email-queue` picks them up
// on its next tick (also every ~5s in the queue's own cron).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_AUTO_RETRIES = 3;
const QUEUES = ["auth_emails", "transactional_emails"] as const;

Deno.serve(async (req) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Auth: accept CRON_SECRET (pg_cron / scheduled invoker) OR an admin JWT
  // (Admin dashboard "Retry failed" button). Anonymous / non-admin callers
  // are rejected.
  const isCron = !!cronSecret && !!bearer && bearer === cronSecret;
  let isAdmin = false;
  if (!isCron && bearer) {
    try {
      const { data: userRes } = await supabase.auth.getUser(bearer);
      const uid = userRes?.user?.id;
      if (uid) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .in("role", ["admin", "super_admin", "platform_owner"])
          .maybeSingle();
        isAdmin = !!roleRow;
      }
    } catch (_) {
      isAdmin = false;
    }
  }
  if (!isCron && !isAdmin) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary: Record<string, { requeued: number; skipped: number; error?: string }> = {};

  for (const queue of QUEUES) {
    const s = { requeued: 0, skipped: 0 } as { requeued: number; skipped: number; error?: string };
    try {
      // Drain up to 100 DLQ messages per queue per tick.
      const { data: dlqRows, error: dlqErr } = await supabase.rpc("pgmq_read_dlq", {
        queue_name: queue,
        n: 100,
      });

      // The helper may not exist on older infra — fall back to reading the
      // real pgmq DLQ table (`pgmq.q_<queue>_dlq`) directly.
      let rows: Array<{ msg_id: number; message: unknown }> = [];
      if (dlqErr) {
        const { data: fallback, error: fbErr } = await supabase
          .schema("pgmq" as never)
          .from(`q_${queue}_dlq` as never)
          .select("msg_id, message")
          .order("enqueued_at", { ascending: true })
          .limit(100) as unknown as { data: any[]; error: any };
        if (fbErr) {
          // Missing DLQ table means "no failures yet" — not a sweeper error.
          const missing = /does not exist|undefined_table|not.*found/i.test(
            String(fbErr.message ?? ""),
          );
          if (!missing) {
            s.error = `read failed: ${fbErr.message || dlqErr.message}`;
          }
          summary[queue] = s;
          continue;
        }
        rows = fallback ?? [];
      } else {
        rows = (dlqRows as any[]) ?? [];
      }


      for (const row of rows) {
        const payload = (row.message ?? {}) as Record<string, unknown>;
        const attempts = Number(payload.auto_retry_count ?? 0);
        const messageId = String(payload.message_id ?? payload.messageId ?? "");
        const recipient = String(payload.recipient_email ?? payload.recipientEmail ?? payload.to ?? "unknown");
        const templateName = String(payload.template_name ?? payload.templateName ?? payload.label ?? "unknown");

        // Detect permanent bounce / invalid recipient in the DLQ payload —
        // never retry these; mark terminal and suppress the address.
        const bounceSeverity = String(
          (payload.bounce_severity as string) ??
            ((payload.last_error as Record<string, unknown> | undefined)?.severity as string) ??
            "",
        ).toLowerCase();
        const lastErrorMsg = String(
          (payload.last_error_message as string) ??
            ((payload.last_error as Record<string, unknown> | undefined)?.message as string) ??
            "",
        ).toLowerCase();
        const isPermanentBounce =
          bounceSeverity === "permanent" ||
          /bounce|invalid recipient|mailbox.*(not\s*found|unavailable)|no such user|550/.test(lastErrorMsg);

        if (isPermanentBounce) {
          s.skipped += 1;
          if (recipient && recipient !== "unknown") {
            await supabase.from("suppressed_emails").upsert(
              { email: recipient, reason: "bounce", metadata: { queue, source: "retry-failed-emails", severity: "permanent" } },
              { onConflict: "email" },
            );
          }
          if (messageId) {
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: recipient,
              status: "failed_permanent",
              error_message: "Permanent bounce — recipient rejected; not retrying",
              metadata: { auto_retry_terminal: true, reason: "permanent_bounce", queue },
            });
          }
          await supabase.rpc("pgmq_delete_dlq", { queue_name: queue, msg_id: row.msg_id }).catch(() => {});
          continue;
        }

        if (attempts >= MAX_AUTO_RETRIES) {
          s.skipped += 1;
          if (messageId) {
            await supabase.from("email_send_log").insert({
              message_id: messageId,
              template_name: templateName,
              recipient_email: recipient,
              status: "failed_permanent",
              error_message: `Auto-retry exhausted after ${attempts} attempts (max ${MAX_AUTO_RETRIES})`,
              metadata: { auto_retry_terminal: true, reason: "retry_cap_exhausted", attempts, queue },
            });
          }
          await supabase.rpc("pgmq_delete_dlq", { queue_name: queue, msg_id: row.msg_id }).catch(() => {});
          continue;
        }

        // Re-enqueue with the incremented counter.
        const newPayload = { ...payload, auto_retry_count: attempts + 1, auto_retry_at: new Date().toISOString() };
        const { error: enqErr } = await supabase.rpc("enqueue_email", {
          queue_name: queue,
          payload: newPayload,
        });
        if (enqErr) {
          s.error = `enqueue failed: ${enqErr.message}`;
          continue;
        }

        // Best-effort DLQ delete.
        await supabase.rpc("pgmq_delete_dlq", { queue_name: queue, msg_id: row.msg_id }).catch(() => {});

        if (messageId) {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: (payload.template_name ?? payload.templateName ?? "unknown") as string,
            recipient_email: (payload.recipient_email ?? payload.recipientEmail ?? "unknown") as string,
            status: "pending",
            error_message: `Auto-retry ${attempts + 1}/${MAX_AUTO_RETRIES}`,
            metadata: { auto_retry_count: attempts + 1, queue },
          });
        }
        s.requeued += 1;
        console.log(`[retry-failed-emails] requeued ${queue} msg=${row.msg_id} attempt=${attempts + 1}`);
      }
    } catch (e) {
      s.error = e instanceof Error ? e.message : String(e);
      console.error(`[retry-failed-emails] ${queue} error`, e);
    }
    summary[queue] = s;
  }

  // -----------------------------------------------------------------------
  // Reconciliation pass: sweep `email_send_log` rows whose LATEST status is
  // still `pending` after the queue TTL window. These are logs where the
  // queue worker crashed, the run was purged, or a pre-queue write never got
  // a terminal event. We stamp a terminal `dlq` row so dashboards, admin
  // metrics, and dedup queries stop counting them as in-flight.
  // -----------------------------------------------------------------------
  const RECONCILE_STALE_MINUTES = 60; // matches transactional TTL upper bound
  const reconciled: { scanned: number; closed: number; error?: string } = { scanned: 0, closed: 0 };
  try {
    const cutoff = new Date(Date.now() - RECONCILE_STALE_MINUTES * 60_000).toISOString();
    // Pull recent pending rows; dedup by message_id in-memory (avoids a
    // heavy DISTINCT ON query at scale).
    const { data: pendingRows, error: pendErr } = await supabase
      .from("email_send_log")
      .select("message_id, template_name, recipient_email, created_at")
      .eq("status", "pending")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(500);
    if (pendErr) throw pendErr;
    reconciled.scanned = pendingRows?.length ?? 0;

    const seen = new Set<string>();
    const closures: Array<Record<string, unknown>> = [];
    for (const r of pendingRows ?? []) {
      const mid = String(r.message_id ?? "");
      if (!mid || seen.has(mid)) continue;
      seen.add(mid);
      // Confirm no later terminal row exists for this message_id.
      const { data: terminal } = await supabase
        .from("email_send_log")
        .select("status")
        .eq("message_id", mid)
        .in("status", ["sent", "dlq", "bounced", "suppressed", "failed", "failed_permanent"])
        .gt("created_at", r.created_at)
        .limit(1);
      if (terminal && terminal.length > 0) continue;
      closures.push({
        message_id: mid,
        template_name: r.template_name ?? "unknown",
        recipient_email: r.recipient_email ?? "unknown",
        status: "failed_permanent",
        error_message: `reconciled: pending > ${RECONCILE_STALE_MINUTES}m with no terminal event`,
        metadata: { reconciled: true, source: "retry-failed-emails", reason: "stale_pending" },
      });
    }
    if (closures.length > 0) {
      const { error: insErr } = await supabase.from("email_send_log").insert(closures);
      if (insErr) throw insErr;
      reconciled.closed = closures.length;
      console.log(`[retry-failed-emails] reconciled ${closures.length} stuck pending rows`);
    }
  } catch (e) {
    reconciled.error = e instanceof Error ? e.message : String(e);
    console.error("[retry-failed-emails] reconciliation error", e);
  }

  // -----------------------------------------------------------------------
  // Post-run audit: `email_send_log` is append-only — one `pending` row on
  // enqueue, a separate terminal row on delivery. A raw
  // `WHERE status='pending'` count therefore includes every historical row
  // for successfully sent emails and always false-fails.
  //
  // The correct invariant: no `message_id` should have `pending` as its
  // LATEST status. We pull recent pending rows, then filter out any whose
  // message_id has a later terminal row.
  // -----------------------------------------------------------------------
  const audit: { pending_remaining: number; passed: boolean; error?: string } = {
    pending_remaining: 0,
    passed: true,
  };
  try {
    const { data: pending, error: auditErr } = await supabase
      .from("email_send_log")
      .select("message_id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (auditErr) throw auditErr;
    const TERMINAL = ["sent", "dlq", "bounced", "suppressed", "failed", "failed_permanent", "complained"];
    let stuck = 0;
    const seen = new Set<string>();
    for (const p of pending ?? []) {
      const mid = p.message_id;
      if (!mid || seen.has(mid)) continue;
      seen.add(mid);
      const { data: terminal } = await supabase
        .from("email_send_log")
        .select("status")
        .eq("message_id", mid)
        .in("status", TERMINAL)
        .gt("created_at", p.created_at)
        .limit(1);
      if (!terminal || terminal.length === 0) stuck += 1;
    }
    audit.pending_remaining = stuck;
    audit.passed = stuck === 0;
    if (!audit.passed) {
      console.warn(`[retry-failed-emails] AUDIT: ${stuck} message_ids still pending after sweep`);
    } else {
      console.log("[retry-failed-emails] AUDIT PASSED: 0 message_ids remain pending");
    }
  } catch (e) {
    audit.passed = false;
    audit.error = e instanceof Error ? e.message : String(e);
    console.error("[retry-failed-emails] audit error", e);
  }

  // Persist the audit result so admins can review historical runs. This is
  // deliberately separate from the sweep outcome: if the audit log write
  // fails, the sweep itself may still have succeeded and MUST be reported
  // as such.
  let auditPersistStatus: "ok" | "failed" = "ok";
  let auditPersistError: string | null = null;
  try {
    const { error: persistErr } = await supabase.from("admin_audit_log").insert({
      action: "email_retry_audit",
      details: {
        audit,
        summary,
        reconciled,
        ran_at: new Date().toISOString(),
      },
    });
    if (persistErr) throw persistErr;
  } catch (e) {
    auditPersistStatus = "failed";
    // Redact any accidental identifier leakage — only surface the class.
    auditPersistError = (e instanceof Error ? e.message : String(e)).replace(
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
      "[email]",
    );
    console.error("[retry-failed-emails] failed to persist audit log", e);
  }

  // ---------------------------------------------------------------------
  // Outcome classification, separated per the reliability contract:
  //   • sweep_status:   did the queue drain + reconcile pass run at all?
  //   • audit_status:   did the post-run audit + admin_audit_log write succeed?
  //   • http status:    2xx unless the sweep itself failed catastrophically.
  // ---------------------------------------------------------------------
  const anyQueueError = Object.values(summary).some((s) => !!s.error);
  const allQueuesErrored =
    Object.keys(summary).length > 0 &&
    Object.values(summary).every((s) => !!s.error);
  const sweepFailed = allQueuesErrored && !!reconciled.error;
  const sweepStatus: "ok" | "degraded" | "failed" =
    sweepFailed ? "failed" : anyQueueError || reconciled.error ? "degraded" : "ok";
  // audit_status now reflects ONLY whether admin_audit_log persistence
  // succeeded. `pending_remaining` is informational and reported separately.
  const auditStatus: "ok" | "failed" =
    auditPersistStatus === "ok" ? "ok" : "failed";
  const hasWarnings = sweepStatus !== "ok" || auditStatus !== "ok";

  if (hasWarnings) {
    try {
      await supabase.from("admin_audit_log").insert({
        action: "email_retry_alert",
        details: {
          severity: sweepFailed ? "critical" : "warning",
          summary,
          reconciled,
          audit,
          flags: {
            any_queue_error: anyQueueError,
            reconcile_error: !!reconciled.error,
            audit_error: !!audit.error,
            audit_persist_error: auditPersistStatus === "failed",
            sweep_failed: sweepFailed,
          },
          alerted_at: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error("[retry-failed-emails] failed to persist alert row", e);
    }
    console.warn("[retry-failed-emails] ALERT emitted", {
      sweepStatus, auditStatus,
      reconcile_error: !!reconciled.error, audit_error: !!audit.error,
    });
  }

  // Sweep-level failure → structured non-2xx. Audit-only failures stay 2xx.
  const httpStatus = sweepFailed ? 502 : 200;

  return new Response(
    JSON.stringify({
      ok: sweepStatus !== "failed",
      sweep_status: sweepStatus,
      audit_status: auditStatus,
      audit_persist_status: auditPersistStatus,
      audit_persist_error: auditPersistError,
      pending_remaining: audit.pending_remaining,
      degraded: hasWarnings,
      ...summary,
      reconciled,
      audit,
      alert: hasWarnings
        ? {
            severity: sweepFailed ? "critical" : "warning",
            queue_errors: anyQueueError,
            reconcile_error: !!reconciled.error,
            audit_error: !!audit.error,
            audit_persist_error: auditPersistStatus === "failed",
          }
        : undefined,
      warnings: hasWarnings
        ? {
            queue_errors: anyQueueError,
            reconcile_error: !!reconciled.error,
            audit_error: !!audit.error,
            audit_persist_error: auditPersistStatus === "failed",
          }
        : undefined,
    }),
    {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
  } catch (e) {
    // Unhandled crash BEFORE the sweep completes → real failure. Return a
    // proper non-2xx so the admin UI shows "Failed" and monitoring can page.
    console.error("[retry-failed-emails] unhandled error", e);
    return new Response(
      JSON.stringify({
        ok: false,
        sweep_status: "failed",
        audit_status: "failed",
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


