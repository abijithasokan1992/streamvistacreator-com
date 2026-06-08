import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createHmac } from "node:crypto";
import { computeFinalPricePaise, type Cycle } from "../_shared/pricing.ts";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { onboardingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!onboardingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return jsonError("Missing fields", 400);
    }

    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !keyId || !supabaseUrl || !serviceKey) {
      console.error("Missing required environment configuration");
      return jsonError("Service temporarily unavailable", 503);
    }

    const expected = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const signatureValid = expected === razorpay_signature;
    if (!signatureValid) {
      return jsonError("Payment verification failed", 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Look up the onboarding row and verify the order belongs to it.
    const { data: row, error: rowErr } = await supabase
      .from("onboarding_requests")
      .select("id, selected_cycle, promo_code, razorpay_order_id")
      .eq("id", onboardingId)
      .single();
    if (rowErr || !row || row.razorpay_order_id !== razorpay_order_id) {
      return jsonError("Payment verification failed", 400);
    }

    // Recompute expected amount server-side.
    let priced;
    try {
      priced = computeFinalPricePaise(row.selected_cycle as Cycle, row.promo_code);
    } catch {
      return jsonError("Payment verification failed", 400);
    }

    // Cross-check actual amount with Razorpay's order record.
    const auth = btoa(`${keyId}:${secret}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error("Razorpay order fetch failed", orderData);
      return jsonError("Payment verification failed", 502);
    }

    if (orderData.amount !== priced.finalPaise || orderData.status !== "paid") {
      console.error("Amount mismatch", { expected: priced.finalPaise, got: orderData.amount, status: orderData.status });
      return jsonError("Payment verification failed", 400);
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

    return new Response(JSON.stringify({ verified: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-razorpay-payment error:", e);
    return jsonError("Internal server error", 500);
  }
});
