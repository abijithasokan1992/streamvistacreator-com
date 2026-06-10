// Flags inactive accounts at the configured threshold and freezes them at the
// second threshold. Frozen accounts are surfaced in the admin so they can be
// hard-deleted via the existing admin-users cascade (which already purges OCI
// + cancels billing). We never delete here on our own.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!cronSecret || !bearer || bearer !== cronSecret) {
    return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: cfg } = await supa.from("billing_config")
      .select("idle_flag_days, idle_freeze_days").eq("id", 1).single();
    if (!cfg) throw new Error("billing_config missing");

    const now = Date.now();
    const flagCutoff = new Date(now - cfg.idle_flag_days * 86400_000).toISOString();
    const freezeCutoff = new Date(now - cfg.idle_freeze_days * 86400_000).toISOString();

    // Flag (active -> flagged)
    const { data: flagged, error: e1 } = await supa
      .from("user_profiles")
      .update({ idle_status: "flagged", idle_flagged_at: new Date().toISOString() })
      .lt("last_active_at", flagCutoff)
      .eq("idle_status", "active")
      .select("user_id");
    if (e1) throw e1;

    // Freeze (flagged -> frozen)
    const { data: frozen, error: e2 } = await supa
      .from("user_profiles")
      .update({ idle_status: "frozen", idle_frozen_at: new Date().toISOString() })
      .lt("last_active_at", freezeCutoff)
      .eq("idle_status", "flagged")
      .select("user_id");
    if (e2) throw e2;

    return new Response(JSON.stringify({
      ok: true,
      flagged: flagged?.length ?? 0,
      frozen: frozen?.length ?? 0,
      flag_cutoff: flagCutoff,
      freeze_cutoff: freezeCutoff,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("reclaim-idle failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
