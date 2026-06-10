// Admin-only: creates a real Razorpay order against the currently configured
// Razorpay credentials (test or live) for the minimum amount (₹1) so the admin
// can exercise the Checkout SDK end-to-end without touching real customer rows.
// Nothing in `onboarding_requests` is created or modified — the order is logged
// to `razorpay_audit_log` with source='admin-test'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

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

    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json(req, { error: "Razorpay not configured" }, 503);

    // Always ₹1 (100 paise). Server-controlled, never trusts the caller.
    const amountPaise = 100;
    const currency = "INR";
    const receipt = `admin_test_${Date.now()}`;

    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt,
        notes: { admin_test: "true", admin_user_id: userId },
      }),
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("admin-test order create failed", orderData);
      return json(req, { error: "Order create failed", details: orderData }, 502);
    }

    try {
      await admin.from("razorpay_audit_log").insert({
        event_type: "admin.test.order_created",
        source: "admin-test",
        order_id: orderData.id,
        amount_paise: amountPaise,
        currency,
        status: orderData.status ?? "created",
        signature_valid: true,
        user_id: userId,
        payload: { receipt, mode: creds.mode },
      });
    } catch (e) { console.error("audit insert failed", e); }

    return json(req, {
      keyId: creds.keyId,
      mode: creds.mode,
      orderId: orderData.id,
      amount: amountPaise,
      currency,
      receipt,
    });
  } catch (e) {
    console.error("generate-test-razorpay-order error", e);
    return json(req, { error: "Internal error" }, 500);
  }
});
