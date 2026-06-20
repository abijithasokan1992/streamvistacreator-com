// topup-sweep — marks stale pending storage_topups as abandoned.
// Idempotent. Designed to be triggered hourly by pg_cron via net.http_post.
// SECURITY: Uses the service role key (Supabase-managed). The underlying
// RPC `sweep_abandoned_topups` is SECURITY DEFINER and admin/service-only.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let olderThanHours = 24;
    try {
      const body = await req.json();
      if (body && typeof body.hours === "number" && body.hours >= 1 && body.hours <= 720) {
        olderThanHours = Math.floor(body.hours);
      }
    } catch { /* no body / cron call */ }

    const supabase = createClient(url, serviceKey);
    const { data, error } = await supabase.rpc("sweep_abandoned_topups", {
      _older_than_hours: olderThanHours,
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
