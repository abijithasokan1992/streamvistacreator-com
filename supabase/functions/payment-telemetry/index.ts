// Frontend telemetry endpoint: authenticated users may post structured logs
// about the Razorpay checkout lifecycle from the browser (e.g. modal opened,
// modal dismissed, handler error). RLS on payment_debug_logs ensures the
// caller can only write rows under their own user_id with source='frontend'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_ACTIONS = new Set([
  "checkout.sdk_loaded",
  "checkout.modal_init",
  "checkout.modal_opened",
  "checkout.modal_dismissed",
  "checkout.handler_success",
  "checkout.handler_error",
  "checkout.network_error",
]);

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json(req, { error: "unavailable" }, 503);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

  // Use the user's JWT so the INSERT is governed by the
  // "Users insert own frontend telemetry" RLS policy.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (userErr || !userId) return json(req, { error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const action_type = String(body?.action_type ?? "");
  if (!ALLOWED_ACTIONS.has(action_type)) {
    return json(req, { error: "Invalid action_type" }, 400);
  }

  const severity = ["INFO", "WARN", "ERROR"].includes(body?.severity) ? body.severity : "INFO";
  const order_id = body?.order_id ? String(body.order_id).slice(0, 64) : null;
  const payment_id = body?.payment_id ? String(body.payment_id).slice(0, 64) : null;
  const error_message = body?.error_message ? String(body.error_message).slice(0, 1000) : null;
  const duration_ms = Number.isFinite(body?.duration_ms) ? Math.max(0, Math.min(600_000, Math.round(body.duration_ms))) : null;
  const extra = (body?.extra && typeof body.extra === "object") ? body.extra : {};

  const { error } = await supabase.from("payment_debug_logs").insert({
    severity,
    action_type,
    source: "frontend",
    user_id: userId,
    order_id,
    payment_id,
    error_message,
    duration_ms,
    extra,
  });
  if (error) return json(req, { error: error.message }, 400);

  return json(req, { ok: true });
});
