import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { computeFinalPricePaise, type Cycle } from "../_shared/pricing.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

function jsonError(req: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
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
    if (!supabaseUrl || !serviceKey || !anonKey) {
      console.error("Missing required environment configuration");
      return jsonError(req, "Service temporarily unavailable", 503);
    }

    // Require an authenticated caller. Prevents anonymous parties from
    // hijacking an onboarding row's payment flow with just its UUID.
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(req, "Authentication required", 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user?.id) {
      return jsonError(req, "Invalid session", 401);
    }

    const { onboardingId } = await req.json();
    if (!onboardingId || typeof onboardingId !== "string") {
      return jsonError(req, "Invalid input", 400);
    }
    const CURRENCY = "INR"; // hardcoded — never trust caller

    const supabase = createClient(supabaseUrl, serviceKey);
    const creds = await loadRazorpayCreds(supabase);
    if (!creds) {
      console.error("Razorpay credentials are not configured");
      return jsonError(req, "Payments are not configured. Please contact support.", 503);
    }
    const { keyId, keySecret } = creds;

    // Fetch the onboarding request server-side and compute the authoritative price.
    const { data: row, error: fetchErr } = await supabase
      .from("onboarding_requests")
      .select("id, selected_cycle, promo_code, razorpay_order_id, amount_paid_paise")
      .eq("id", onboardingId)
      .single();
    if (fetchErr || !row) {
      return jsonError(req, "Onboarding request not found", 404);
    }

    // Idempotency guard: if an order already exists for this onboarding row, return it.
    if (row.razorpay_order_id) {
      return new Response(
        JSON.stringify({
          orderId: row.razorpay_order_id,
          amount: row.amount_paid_paise,
          currency: "INR",
          keyId,
        }),
        { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    let priced;
    try {
      priced = computeFinalPricePaise(row.selected_cycle as Cycle, row.promo_code);
    } catch {
      return jsonError(req, "Invalid plan configuration", 400);
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
      return jsonError(req, "Order creation failed", 502);
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
      { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-razorpay-order error:", e);
    return jsonError(req, "Internal server error", 500);
  }
});
