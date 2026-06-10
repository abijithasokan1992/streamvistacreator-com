// Recomputes per-user storage from recent_uploads, refreshes usage_meters,
// and inserts pending overage rows for the current billing period.
// Bandwidth & API counters are passed through if already recorded by callers;
// this job never resets them.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  const bearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!cronSecret || !bearer || bearer !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const period = periodStart.toISOString().slice(0, 10);

    const { data: cfg } = await supa.from("billing_config").select("*").eq("id", 1).single();
    if (!cfg) throw new Error("billing_config missing");

    // Aggregate live storage from recent_uploads
    const { data: usage, error: aggErr } = await supa
      .from("recent_uploads")
      .select("user_id, file_size")
      .neq("status", "deleted");
    if (aggErr) throw aggErr;

    const totals = new Map<string, number>();
    for (const row of usage ?? []) {
      const cur = totals.get(row.user_id) ?? 0;
      totals.set(row.user_id, cur + Number(row.file_size || 0));
    }

    let metersWritten = 0;
    let overagesQueued = 0;
    let overagePaiseTotal = 0;

    for (const [userId, bytes] of totals.entries()) {
      const storageGb = bytes / (1024 ** 3);

      await supa.from("usage_meters").upsert({
        user_id: userId,
        period_start: period,
        storage_gb: storageGb,
        last_recomputed_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      metersWritten++;

      // Determine tier allowance
      const { data: profile } = await supa
        .from("user_profiles")
        .select("plan_tier, topup_tb")
        .eq("user_id", userId)
        .maybeSingle();
      const tier = (profile?.plan_tier ?? "free").toLowerCase();
      const topupTb = Number(profile?.topup_tb ?? 0);
      const allowanceGb =
        tier === "free"
          ? Number(cfg.free_tier_gb)
          : Number(cfg.creator_tier_tb) * 1024 + topupTb * 1024;

      const overGb = Math.max(0, storageGb - allowanceGb);
      if (overGb <= 0) continue;

      const amountPaise = Math.ceil(overGb * Number(cfg.storage_rate_paise_per_gb));
      await supa.from("usage_overages").upsert({
        user_id: userId,
        period_start: period,
        kind: "storage",
        units: overGb,
        rate_paise: cfg.storage_rate_paise_per_gb,
        amount_paise: amountPaise,
        status: "pending",
      }, { onConflict: "user_id,period_start,kind" });
      overagesQueued++;
      overagePaiseTotal += amountPaise;
    }

    return new Response(
      JSON.stringify({
        ok: true, period, metersWritten, overagesQueued,
        overage_rupees: Math.round(overagePaiseTotal / 100),
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("track-usage failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
