// Admin-only Razorpay config helper.
// Actions:
//   - "status": returns whether credentials are configured (masked), mode, last update.
//   - "test":   verifies arbitrary creds (or stored creds) against Razorpay's /v1/orders sandbox check.
// Saving credentials is done directly from the client via RLS (admins only).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function mask(s?: string | null) {
  if (!s) return null;
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return json(req, { error: "Service unavailable" }, 503);
  }

  // Verify caller is an authenticated admin.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await userClient.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return json(req, { error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json(req, { error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action = body?.action as string | undefined;

  if (action === "status") {
    const creds = await loadRazorpayCreds(admin);
    const { data: row } = await admin
      .from("razorpay_config")
      .select("mode, updated_at, key_id")
      .eq("id", true)
      .maybeSingle();
    return json(req, {
      configured: !!creds,
      source: creds?.source ?? null,
      mode: row?.mode ?? creds?.mode ?? "test",
      key_id_preview: mask(row?.key_id ?? creds?.keyId ?? null),
      webhook_set: !!Deno.env.get("RAZORPAY_WEBHOOK_SECRET"),
      updated_at: row?.updated_at ?? null,
    });
  }

  if (action === "test") {
    const keyId = (body?.keyId ?? "").toString().trim();
    const keySecret = (body?.keySecret ?? "").toString().trim();
    let useId = keyId, useSecret = keySecret;
    if (!useId || !useSecret) {
      const creds = await loadRazorpayCreds(admin);
      if (!creds) return json(req, { ok: false, error: "No credentials configured" }, 400);
      useId = creds.keyId; useSecret = creds.keySecret;
    }
    try {
      const auth = btoa(`${useId}:${useSecret}`);
      const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      const okFlag = res.ok;
      const detail = okFlag ? null : await res.json().catch(() => ({}));
      const msg = okFlag ? "Razorpay credentials are valid." : (detail?.error?.description || `HTTP ${res.status}`);
      try {
        await admin.from("razorpay_audit_log").insert({
          event_type: "admin.test",
          source: "razorpay-admin",
          status: okFlag ? "success" : "failed",
          error_code: okFlag ? null : String(res.status),
          error_description: okFlag ? null : msg,
          user_id: uid,
          payload: { key_id_preview: mask(useId) },
        });
      } catch (e) { console.error("audit insert failed", e); }
      return json(req, okFlag ? { ok: true, message: msg } : { ok: false, error: msg }, 200);
    } catch (e: any) {
      return json(req, { ok: false, error: e?.message || "Network error" }, 200);
    }
  }

  return json(req, { error: "Unknown action" }, 400);
});
