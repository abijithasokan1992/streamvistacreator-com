import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
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
    const { onboardingId } = await req.json();
    if (!onboardingId || typeof onboardingId !== "string") {
      return jsonError("Invalid input", 400);
    }
    const CURRENCY = "INR"; // hardcoded — never trust caller

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!keyId || !keySecret || !supabaseUrl || !serviceKey) {
      console.error("Missing required environment configuration");
      return jsonError("Service temporarily unavailable", 503);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the onboarding request server-side and compute the authoritative price.
    const { data: row, error: fetchErr } = await supabase
      .from("onboarding_requests")
      .select("id, selected_cycle, promo_code, razorpay_order_id, amount_paid_paise")
      .eq("id", onboardingId)
      .single();
    if (fetchErr || !row) {
      return jsonError("Onboarding request not found", 404);
    }

    // Idempotency guard: if an order already exists for this onboarding row, return it.
    // Prevents an attacker from re-creating orders and overwriting the legitimate one.
    if (row.razorpay_order_id) {
      const keyId2 = Deno.env.get("RAZORPAY_KEY_ID")!;
      return new Response(
        JSON.stringify({
          orderId: row.razorpay_order_id,
          amount: row.amount_paid_paise,
          currency: "INR",
          keyId: keyId2,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let priced;
    try {
      priced = computeFinalPricePaise(row.selected_cycle as Cycle, row.promo_code);
    } catch {
      return jsonError("Invalid plan configuration", 400);
    }
    const amountPaise = priced.finalPaise;

    const auth = btoa(`${keyId}:${keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: CURRENCY,
        receipt: `onb_${onboardingId.slice(0, 30)}`,
        notes: { onboarding_id: onboardingId },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order error", order);
      return jsonError("Order creation failed", 502);
    }

    await supabase
      .from("onboarding_requests")
      .update({
        razorpay_order_id: order.id,
        amount_paid_paise: order.amount,
        final_price: amountPaise / 100,
      })
      .eq("id", onboardingId);

    return new Response(
      JSON.stringify({ orderId: order.id, amount: order.amount, currency: order.currency, keyId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-razorpay-order error:", e);
    return jsonError("Internal server error", 500);
  }
});
