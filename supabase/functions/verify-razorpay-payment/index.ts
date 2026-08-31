import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { verifyPaymentSignature } from "../_shared/razorpay-signature.ts";
import { computeFinalPricePaise, type Cycle } from "../_shared/pricing.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";
import { logPayment, timer } from "../_shared/payment-logger.ts";

function jsonError(req: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });

  try {
    const { onboardingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!onboardingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return jsonError(req, "Missing fields", 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("Missing required environment configuration");
      return jsonError(req, "Service temporarily unavailable", 503);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonError(req, "Unauthorized", 401);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (userErr || !userId) return jsonError(req, "Unauthorized", 401);

    const supabase = createClient(supabaseUrl, serviceKey);
    const creds = await loadRazorpayCreds(supabase);
    if (!creds) {
      console.error("Razorpay credentials are not configured");
      return jsonError(req, "Service temporarily unavailable", 503);
    }
    const { keyId, keySecret: secret } = creds;

    const signatureValid = await verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret,
    );
    if (!signatureValid) {
      return jsonError(req, "Payment verification failed", 400);
    }

    const { data: row, error: rowErr } = await supabase
      .from("onboarding_requests")
      .select("id, selected_cycle, promo_code, razorpay_order_id, submitter_user_id, payment_status")
      .eq("id", onboardingId)
      .single();
    if (rowErr || !row || row.razorpay_order_id !== razorpay_order_id) {
      return jsonError(req, "Payment verification failed", 400);
    }

    if (row.submitter_user_id && row.submitter_user_id !== userId) {
      return jsonError(req, "Forbidden", 403);
    }

    if (row.payment_status === "paid") {
      return new Response(JSON.stringify({ verified: true, already: true, planTier: row.selected_cycle }), {
        status: 200,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let priced;
    try {
      priced = computeFinalPricePaise(row.selected_cycle as Cycle, row.promo_code);
    } catch {
      return jsonError(req, "Payment verification failed", 400);
    }

    const auth = btoa(`${keyId}:${secret}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("Razorpay order fetch failed", orderData);
      return jsonError(req, "Payment verification failed", 502);
    }

    if (orderData.amount !== priced.finalPaise || orderData.status !== "paid") {
      console.error("Amount mismatch", { expected: priced.finalPaise, got: orderData.amount, status: orderData.status });
      return jsonError(req, "Payment verification failed", 400);
    }

    await supabase
      .from("onboarding_requests")
      .update({
        payment_status: "paid",
        razorpay_payment_id,
        onboarding_status: "paid",
        amount_paid_paise: orderData.amount,
      })
      .eq("id", onboardingId)
      .eq("razorpay_order_id", razorpay_order_id);

    try {
      await supabase.from("razorpay_audit_log").insert({
        event_type: "verify.payment",
        source: "verify-function",
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        amount_paise: orderData.amount,
        currency: orderData.currency ?? "INR",
        status: orderData.status,
        signature_valid: true,
        user_id: userId,
        payload: { onboardingId, planTier: row.selected_cycle },
      });
    } catch (e) { console.error("audit insert failed", e); }

    await supabase
      .from("user_profiles")
      .update({ plan_tier: row.selected_cycle })
      .eq("user_id", userId);

    await logPayment(supabase, {
      severity: "INFO", action_type: "verify.complete",
      user_id: userId,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      extra: { onboardingId, planTier: row.selected_cycle, amount_paise: orderData.amount },
    });

    return new Response(JSON.stringify({ verified: true, planTier: row.selected_cycle }), {
      status: 200,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-razorpay-payment error:", e);
    return jsonError(req, "Internal server error", 500);
  }
});
