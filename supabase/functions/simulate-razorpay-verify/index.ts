// Admin-only: simulates the verify/webhook step for the admin Razorpay test
// flow. Verifies the HMAC signature using the configured key secret (proving
// the Checkout SDK round-tripped through Razorpay correctly), then writes a
// 'paid' audit row. Never touches onboarding_requests or grants any role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";
import { verifyPaymentSignature } from "../_shared/razorpay-signature.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) return json(req, { error: "unavailable" }, 503);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(req, { error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (userErr || !userId) return json(req, { error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json(req, { error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.razorpay_order_id ?? "");
    const paymentId = String(body?.razorpay_payment_id ?? "");
    const signature = String(body?.razorpay_signature ?? "");
    if (!orderId || !paymentId || !signature) {
      return json(req, { error: "Missing fields" }, 400);
    }

    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json(req, { error: "Razorpay not configured" }, 503);

    const valid = await verifyPaymentSignature(orderId, paymentId, signature, creds.keySecret);

    let alreadyProcessed = false;
    let webhookFinalized = false;
    try {
      const { data: prior } = await admin
        .from("razorpay_audit_log")
        .select("event_type,status,source")
        .eq("order_id", orderId)
        .in("status", ["paid", "captured"])
        .limit(5);
      if (prior && prior.length > 0) {
        alreadyProcessed = true;
        webhookFinalized = prior.some(
          (r: any) => r.source === "webhook" || String(r.event_type).startsWith("payment."),
        );
      }
    } catch (e) { console.error("idempotency check failed", e); }

    try {
      await admin.from("razorpay_audit_log").insert({
        event_type: "admin.test.verify",
        source: "admin-test",
        order_id: orderId,
        payment_id: paymentId,
        status: valid ? "paid" : "signature_failed",
        signature_valid: valid,
        user_id: userId,
        payload: { simulated: true, mode: creds.mode, alreadyProcessed },
      });
    } catch (e) { console.error("audit insert failed", e); }

    if (!valid) return json(req, { ok: false, error: "Signature mismatch" }, 400);

    return json(req, {
      ok: true,
      status: "paid",
      orderId,
      paymentId,
      mode: creds.mode,
      alreadyProcessed,
      webhookFinalized,
    });
  } catch (e) {
    console.error("simulate-razorpay-verify error", e);
    return json(req, { error: "Internal error" }, 500);
  }
});
