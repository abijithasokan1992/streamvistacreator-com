// Admin Test Runner — executes a curated production-readiness test suite
// against the LIVE backend. Read-only where possible; every test returns
// pass/fail, duration, evidence, and a suggested remediation.
//
// Not a replacement for CI/vitest. This is the "green-light before launch"
// smoke pack that any admin can run from the UI.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { readCorrelationId, withCorrelation, logEvent } from "../_shared/correlation.ts";

type TestOutcome = "pass" | "fail" | "skipped" | "warn";
type TestResult = {
  id: string;
  suite: string;
  name: string;
  outcome: TestOutcome;
  duration_ms: number;
  detail: string;
  suggested_fix?: string | null;
  evidence?: Record<string, unknown> | null;
};

async function run(
  suite: string,
  name: string,
  fn: () => Promise<{ outcome: TestOutcome; detail: string; suggested_fix?: string | null; evidence?: Record<string, unknown> }>,
): Promise<TestResult> {
  const id = `${suite}:${name}`;
  const t0 = performance.now();
  try {
    const r = await fn();
    return {
      id, suite, name, outcome: r.outcome, detail: r.detail,
      suggested_fix: r.suggested_fix ?? null, evidence: r.evidence ?? null,
      duration_ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    return {
      id, suite, name, outcome: "fail",
      detail: e instanceof Error ? e.message : String(e),
      suggested_fix: "Investigate — an unexpected exception was thrown.",
      evidence: null, duration_ms: Math.round(performance.now() - t0),
    };
  }
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const cid = readCorrelationId(req);
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), {
      status: s, headers: withCorrelation({ ...cors, "Content-Type": "application/json" }, cid),
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

    logEvent(cid, "test_runner.start", { userId });

    const url = new URL(req.url);
    const suiteFilter = url.searchParams.get("suite");

    const results: TestResult[] = [];

    // ── DATABASE ────────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "database") {
      results.push(await run("database", "connectivity", async () => {
        const { error } = await admin.from("user_roles").select("user_id", { count: "exact", head: true });
        return error
          ? { outcome: "fail", detail: error.message, suggested_fix: "Check Cloud status and RLS." }
          : { outcome: "pass", detail: "Database reachable." };
      }));

      results.push(await run("database", "has_role RPC exists", async () => {
        const { error } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
        return error
          ? { outcome: "fail", detail: error.message, suggested_fix: "Re-create the has_role security-definer function." }
          : { outcome: "pass", detail: "has_role callable." };
      }));

      results.push(await run("database", "user_roles has admin rows", async () => {
        const { count, error } = await admin.from("user_roles").select("*", { count: "exact", head: true })
          .in("role", ["admin", "super_admin"]);
        if (error) return { outcome: "fail", detail: error.message };
        return count && count > 0
          ? { outcome: "pass", detail: `${count} admin role rows.` }
          : { outcome: "fail", detail: "No admins provisioned.", suggested_fix: "Invite at least one admin via the Users console." };
      }));
    }

    // ── AUTH ────────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "auth") {
      results.push(await run("auth", "session token valid", async () => {
        const { data, error } = await anon.auth.getUser();
        return data?.user && !error
          ? { outcome: "pass", detail: `Authed as ${data.user.email ?? data.user.id}` }
          : { outcome: "fail", detail: error?.message ?? "no user" };
      }));
    }

    // ── STORAGE / UPLOADS ────────────────────────────────
    if (!suiteFilter || suiteFilter === "uploads") {
      results.push(await run("uploads", "failed upload backlog under threshold", async () => {
        const { count, error } = await admin.from("ingest_job_items").select("*", { count: "exact", head: true })
          .eq("status", "failed");
        if (error) return { outcome: "fail", detail: error.message };
        const n = count ?? 0;
        if (n > 100) return { outcome: "fail", detail: `${n} failed uploads`, suggested_fix: "Trigger retry-failed-uploads and inspect FailedUploadsInspector." };
        if (n > 25) return { outcome: "warn", detail: `${n} failed uploads`, suggested_fix: "Investigate before launch." };
        return { outcome: "pass", detail: `${n} failed uploads (ok)` };
      }));

      results.push(await run("uploads", "retry cron function exists", async () => {
        const url = Deno.env.get("SUPABASE_URL")!;
        const res = await fetch(`${url}/functions/v1/retry-failed-uploads`, {
          method: "OPTIONS",
          headers: { Origin: "https://streamvistacreator.com" },
        });
        return res.status < 500
          ? { outcome: "pass", detail: `retry-failed-uploads responded ${res.status}.` }
          : { outcome: "fail", detail: `retry-failed-uploads returned ${res.status}.`, suggested_fix: "Redeploy edge function." };
      }));
    }

    // ── EMAIL ────────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "email") {
      results.push(await run("email", "DLQ under threshold", async () => {
        const { count, error } = await admin.from("email_send_log").select("*", { count: "exact", head: true })
          .eq("status", "dlq");
        if (error) return { outcome: "fail", detail: error.message };
        const n = count ?? 0;
        if (n > 50) return { outcome: "fail", detail: `${n} emails in DLQ`, suggested_fix: "Run retry-failed-emails and inspect email_send_log errors." };
        if (n > 10) return { outcome: "warn", detail: `${n} emails in DLQ` };
        return { outcome: "pass", detail: `${n} DLQ emails (ok)` };
      }));

      results.push(await run("email", "recent successful sends", async () => {
        const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
        const { count, error } = await admin.from("email_send_log").select("*", { count: "exact", head: true })
          .eq("status", "sent").gte("created_at", since);
        if (error) return { outcome: "fail", detail: error.message };
        return (count ?? 0) > 0
          ? { outcome: "pass", detail: `${count} emails sent in last 7d.` }
          : { outcome: "warn", detail: "No successful sends in last 7d.", suggested_fix: "Verify DNS + queue processor." };
      }));
    }

    // ── AI GATEWAY ────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "ai") {
      results.push(await run("ai", "LOVABLE_API_KEY configured", async () => {
        const has = !!Deno.env.get("LOVABLE_API_KEY");
        return has
          ? { outcome: "pass", detail: "LOVABLE_API_KEY present." }
          : { outcome: "fail", detail: "LOVABLE_API_KEY missing.", suggested_fix: "Provision via lovable_api_key--create." };
      }));
    }

    // ── SECURITY ─────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "security") {
      results.push(await run("security", "user_roles RLS enabled", async () => {
        // Attempt an anon read; must fail.
        const anon2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data, error } = await anon2.from("user_roles").select("user_id").limit(1);
        if (error) return { outcome: "pass", detail: "Anon read on user_roles blocked by RLS." };
        if ((data ?? []).length === 0) return { outcome: "pass", detail: "Anon read returned nothing (RLS enforcing)." };
        return { outcome: "fail", detail: "Anon can read user_roles!", suggested_fix: "Enable RLS + restrict SELECT policy." };
      }));

      results.push(await run("security", "site_config has primary_domain", async () => {
        const { data, error } = await admin.from("site_config").select("primary_domain").eq("id", true).maybeSingle();
        if (error) return { outcome: "fail", detail: error.message };
        return data?.primary_domain
          ? { outcome: "pass", detail: `primary_domain=${data.primary_domain}` }
          : { outcome: "fail", detail: "primary_domain not set", suggested_fix: "Set in Admin → Settings → Site config." };
      }));
    }

    // ── PAYMENTS ─────────────────────────────────────────
    if (!suiteFilter || suiteFilter === "payments") {
      results.push(await run("payments", "razorpay_config row present", async () => {
        const { count, error } = await admin.from("razorpay_config").select("*", { count: "exact", head: true });
        if (error) return { outcome: "fail", detail: error.message };
        return (count ?? 0) > 0
          ? { outcome: "pass", detail: "razorpay_config configured." }
          : { outcome: "warn", detail: "No Razorpay config.", suggested_fix: "Configure in Admin → Billing → Credentials." };
      }));
    }

    const summary = results.reduce(
      (acc, r) => { acc[r.outcome]++; acc.total++; return acc; },
      { total: 0, pass: 0, fail: 0, skipped: 0, warn: 0 } as Record<string, number>,
    );

    logEvent(cid, "test_runner.done", summary);

    return json({
      correlation_id: cid,
      generated_at: new Date().toISOString(),
      duration_ms: results.reduce((s, r) => s + r.duration_ms, 0),
      summary,
      results,
    });
  } catch (e) {
    logEvent(cid, "test_runner.error", { error: e instanceof Error ? e.message : String(e) });
    return json({ error: e instanceof Error ? e.message : String(e), correlation_id: cid }, 500);
  }
});
