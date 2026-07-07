// Production Readiness Report — aggregates existing signals into one
// executive dashboard. Reuses:
//   - infra-health (live probes)
//   - platform-readiness (5-pillar matrix)
//   - authoritative DB counts (failed uploads, DLQ emails, open incidents)
//
// Admin-only. Read-only. No new tables.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { readCorrelationId, withCorrelation, logEvent } from "../_shared/correlation.ts";

type Status = "healthy" | "warning" | "critical" | "unknown";
type LaunchStatus = "ready" | "ready_with_warnings" | "blocked";

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const cid = readCorrelationId(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s,
      headers: withCorrelation({ ...cors, "Content-Type": "application/json" }, cid),
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: withCorrelation(cors, cid) });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await anon.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) return json({ error: "Forbidden" }, 403);

    logEvent(cid, "readiness_report.start", { userId });

    const base = Deno.env.get("SUPABASE_URL")!;
    const forward = (path: string) =>
      fetch(`${base}/functions/v1/${path}`, {
        headers: {
          Authorization: authHeader,
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
          "x-correlation-id": cid,
        },
      })
        .then((r) => r.json())
        .catch((e) => ({ error: String(e) }));

    // Fan-out — run both existing functions and DB counts in parallel
    const [infra, readiness, failedUploads, dlqEmails, openIncidents, recentTelemetry] =
      await Promise.all([
        forward("infra-health"),
        forward("platform-readiness"),
        admin
          .from("ingest_job_items")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
        admin
          .from("email_send_log")
          .select("*", { count: "exact", head: true })
          .eq("status", "dlq"),
        admin
          .from("ingest_alert_events")
          .select("*", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
        admin
          .from("ingest_telemetry")
          .select("*", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 60 * 60_000).toISOString()),
      ]);

    // ── Capability audit (from platform-readiness) ────────────────────────
    const capabilities = readiness?.capabilities ?? [];
    const pillarPass = capabilities.reduce(
      (n: number, c: any) => n + Object.values(c.pillars ?? {}).filter((p: any) => p?.ok).length,
      0,
    );
    const pillarTotal = capabilities.length * 5;

    // ── Risk register from infra-health failures ──────────────────────────
    const checks = infra?.checks ?? [];
    const risks = checks
      .filter((c: any) => c.status === "critical" || c.status === "warning")
      .map((c: any) => ({
        id: c.id,
        severity: c.status === "critical" ? "high" : "medium",
        title: c.label,
        detail: c.error ?? "Warning threshold breached",
        suggested_action: c.suggested_action,
        category: c.category,
      }));

    // ── Open blockers = critical infra + failed uploads > threshold ──────
    const blockers: Array<{ id: string; message: string; severity: "high" | "medium" }> = [];
    checks
      .filter((c: any) => c.status === "critical")
      .forEach((c: any) =>
        blockers.push({ id: `infra:${c.id}`, message: `${c.label}: ${c.error ?? "critical"}`, severity: "high" }),
      );
    if ((failedUploads?.count ?? 0) > 25) {
      blockers.push({
        id: "uploads:backlog",
        message: `${failedUploads.count} failed uploads pending retry`,
        severity: "medium",
      });
    }
    if ((dlqEmails?.count ?? 0) > 10) {
      blockers.push({
        id: "email:dlq",
        message: `${dlqEmails.count} emails in DLQ`,
        severity: "medium",
      });
    }

    // ── Launch status decision ────────────────────────────────────────────
    let launch_status: LaunchStatus = "ready";
    if (blockers.some((b) => b.severity === "high")) launch_status = "blocked";
    else if (blockers.length > 0 || risks.length > 0) launch_status = "ready_with_warnings";

    // ── Overall health from infra summary ─────────────────────────────────
    const s = infra?.summary ?? { critical: 0, warning: 0, healthy: 0, unknown: 0 };
    const overall: Status =
      s.critical > 0 ? "critical" : s.warning > 0 ? "warning" : s.healthy > 0 ? "healthy" : "unknown";

    // ── Release checklist derived from live signals ───────────────────────
    const checklist = [
      {
        id: "infra_healthy",
        label: "All infrastructure probes healthy",
        ok: s.critical === 0 && s.warning === 0,
        detail: `${s.healthy} healthy · ${s.warning} warning · ${s.critical} critical`,
      },
      {
        id: "readiness_matrix",
        label: "Capability readiness ≥ 90%",
        ok: pillarTotal > 0 && pillarPass / pillarTotal >= 0.9,
        detail: `${pillarPass}/${pillarTotal} pillars passing`,
      },
      {
        id: "no_upload_backlog",
        label: "Failed upload backlog under control (<25)",
        ok: (failedUploads?.count ?? 0) < 25,
        detail: `${failedUploads?.count ?? 0} failed items`,
      },
      {
        id: "no_email_dlq",
        label: "Email DLQ under control (<10)",
        ok: (dlqEmails?.count ?? 0) < 10,
        detail: `${dlqEmails?.count ?? 0} DLQ messages`,
      },
      {
        id: "quiet_alerts",
        label: "No new ingest alert events in last 24h",
        ok: (openIncidents?.count ?? 0) === 0,
        detail: `${openIncidents?.count ?? 0} alert events / 24h`,
      },
      {
        id: "telemetry_flowing",
        label: "Ingest telemetry received in last hour",
        ok: (recentTelemetry?.count ?? 0) > 0,
        detail: `${recentTelemetry?.count ?? 0} events / 60m`,
      },
    ];

    const mvp_completion =
      pillarTotal > 0 ? Math.round((pillarPass / pillarTotal) * 100) : 0;

    logEvent(cid, "readiness_report.done", {
      launch_status,
      blockers: blockers.length,
      risks: risks.length,
      mvp_completion,
    });

    return json({
      correlation_id: cid,
      generated_at: new Date().toISOString(),
      launch_status,
      overall,
      mvp_completion,
      summary: {
        infra: s,
        pillars: { passing: pillarPass, total: pillarTotal },
        failed_uploads: failedUploads?.count ?? 0,
        dlq_emails: dlqEmails?.count ?? 0,
        alerts_24h: openIncidents?.count ?? 0,
      },
      capabilities,
      risks,
      blockers,
      checklist,
      infra_checks: checks,
    });
  } catch (e) {
    logEvent(cid, "readiness_report.error", { error: e instanceof Error ? e.message : String(e) });
    return json({ error: e instanceof Error ? e.message : String(e), correlation_id: cid }, 500);
  }
});
