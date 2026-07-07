// Metrics & Observability — aggregates authoritative backend data into
// p50/p95/p99 latency, throughput, failure and retry counts per subsystem.
//
// No new tables. Reads from:
//   - email_send_log       (email delivery)
//   - ingest_job_items     (uploads)
//   - ingest_telemetry     (upload latency)
//   - payment_traces       (billing)
//   - razorpay_webhook_ledger (webhook durations)
//
// Admin-only.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { readCorrelationId, withCorrelation, logEvent } from "../_shared/correlation.ts";

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function summarize(values: number[]) {
  if (values.length === 0) return { count: 0, p50: null, p95: null, p99: null, avg: null };
  const sorted = [...values].sort((a, b) => a - b);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    count: values.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg,
  };
}

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

    const url = new URL(req.url);
    const windowHours = Math.min(168, Math.max(1, Number(url.searchParams.get("window") ?? "24")));
    const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
    logEvent(cid, "metrics.start", { windowHours });

    const [emails, uploads, telemetry, payments, webhooks, ingestJobs] = await Promise.all([
      admin.from("email_send_log")
        .select("status,template_name,created_at,message_id")
        .gte("created_at", since)
        .limit(5000),
      admin.from("ingest_job_items")
        .select("status,created_at,updated_at,error_message")
        .gte("created_at", since)
        .limit(5000),
      admin.from("ingest_telemetry")
        .select("stage,duration_ms,created_at,succeeded")
        .gte("created_at", since)
        .not("duration_ms", "is", null)
        .limit(5000),
      admin.from("payment_traces")
        .select("status,created_at,updated_at")
        .gte("created_at", since)
        .limit(2000),
      admin.from("razorpay_webhook_ledger")
        .select("duration_ms,status,created_at")
        .gte("created_at", since)
        .not("duration_ms", "is", null)
        .limit(2000),
      admin.from("ingest_jobs")
        .select("status,created_at")
        .gte("created_at", since)
        .limit(5000),
    ]);

    // ── Emails: dedupe by message_id → latest row ──
    const emailLatest = new Map<string, any>();
    (emails.data ?? []).forEach((r: any) => {
      const k = r.message_id ?? r.created_at;
      const prev = emailLatest.get(k);
      if (!prev || prev.created_at < r.created_at) emailLatest.set(k, r);
    });
    const emailRows = Array.from(emailLatest.values());
    const emailStats = {
      total: emailRows.length,
      sent: emailRows.filter((r) => r.status === "sent").length,
      failed: emailRows.filter((r) => r.status === "dlq" || r.status === "failed").length,
      suppressed: emailRows.filter((r) => r.status === "suppressed").length,
      pending: emailRows.filter((r) => r.status === "pending").length,
    };

    // ── Uploads ──
    const uploadRows = uploads.data ?? [];
    const uploadStats = {
      total: uploadRows.length,
      completed: uploadRows.filter((r: any) => r.status === "completed" || r.status === "succeeded").length,
      failed: uploadRows.filter((r: any) => r.status === "failed").length,
      in_progress: uploadRows.filter((r: any) => r.status === "in_progress" || r.status === "pending").length,
    };

    // ── Upload latency from telemetry (duration_ms per stage) ──
    const durations = (telemetry.data ?? [])
      .map((r: any) => Number(r.duration_ms))
      .filter((n) => Number.isFinite(n) && n >= 0);
    const uploadLatency = summarize(durations);

    // Group latency by stage
    const stageMap = new Map<string, number[]>();
    (telemetry.data ?? []).forEach((r: any) => {
      if (!Number.isFinite(r.duration_ms)) return;
      const arr = stageMap.get(r.stage) ?? [];
      arr.push(Number(r.duration_ms));
      stageMap.set(r.stage, arr);
    });
    const stageBreakdown = Array.from(stageMap.entries()).map(([stage, arr]) => ({
      stage,
      ...summarize(arr),
    }));

    // ── Payments ──
    const paymentRows = payments.data ?? [];
    const paymentStats = {
      total: paymentRows.length,
      captured: paymentRows.filter((r: any) => r.status === "captured" || r.status === "success").length,
      failed: paymentRows.filter((r: any) => r.status === "failed").length,
    };

    // ── Webhooks latency ──
    const webhookDurations = (webhooks.data ?? [])
      .map((r: any) => Number(r.duration_ms))
      .filter((n) => Number.isFinite(n));
    const webhookLatency = summarize(webhookDurations);

    // ── Throughput per hour (uploads + emails) ──
    const bucket = (isoList: string[]) => {
      const map = new Map<string, number>();
      isoList.forEach((iso) => {
        const h = iso.slice(0, 13); // "YYYY-MM-DDTHH"
        map.set(h, (map.get(h) ?? 0) + 1);
      });
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, n]) => ({ hour, n }));
    };

    logEvent(cid, "metrics.done", { windowHours, emails: emailStats.total, uploads: uploadStats.total });

    return json({
      correlation_id: cid,
      window_hours: windowHours,
      generated_at: new Date().toISOString(),
      email: emailStats,
      uploads: uploadStats,
      upload_latency_ms: uploadLatency,
      upload_stage_latency_ms: stageBreakdown,
      payments: paymentStats,
      webhook_latency_ms: webhookLatency,
      ingest_jobs_total: (ingestJobs.data ?? []).length,
      throughput: {
        uploads_per_hour: bucket(uploadRows.map((r: any) => r.created_at)),
        emails_per_hour: bucket(emailRows.map((r: any) => r.created_at)),
      },
    });
  } catch (e) {
    logEvent(cid, "metrics.error", { error: e instanceof Error ? e.message : String(e) });
    return json({ error: e instanceof Error ? e.message : String(e), correlation_id: cid }, 500);
  }
});
