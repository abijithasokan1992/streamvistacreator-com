// Razorpay webhook handler.
// Configure this URL in Razorpay Dashboard → Settings → Webhooks:
//   https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/razorpay-webhook
// Subscribed events: payment.captured, payment.failed, order.paid, refund.processed
// Set the webhook secret as RAZORPAY_WEBHOOK_SECRET in edge function secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac, timingSafeEqual } from "node:crypto";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error("razorpay-webhook: missing env");
    return ok({ error: "unavailable" }, 503);
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");

  // Constant-time compare
  try {
    const a = new TextEncoder().encode(sig);
    const b = new TextEncoder().encode(expected);
    if (a.byteLength !== b.byteLength || !timingSafeEqual(a, b)) {
      return ok({ error: "invalid signature" }, 400);
    }
  } catch {
    return ok({ error: "invalid signature" }, 400);
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return ok({ error: "bad json" }, 400); }

  const supabase = createClient(supabaseUrl, serviceKey);
  const type = event?.event as string;
  const payment = event?.payload?.payment?.entity;
  const order = event?.payload?.order?.entity;
  const orderId = payment?.order_id ?? order?.id;

  try {
    if (!orderId) return ok({ received: true, ignored: "no order id" });

    if (type === "payment.captured" || type === "order.paid") {
      await supabase
        .from("onboarding_requests")
        .update({
          payment_status: "paid",
          onboarding_status: "paid",
          razorpay_payment_id: payment?.id ?? null,
          amount_paid_paise: payment?.amount ?? order?.amount ?? null,
        })
        .eq("razorpay_order_id", orderId);
    } else if (type === "payment.failed") {
      await supabase
        .from("onboarding_requests")
        .update({ payment_status: "failed" })
        .eq("razorpay_order_id", orderId);
    } else if (type === "refund.processed") {
      await supabase
        .from("onboarding_requests")
        .update({ payment_status: "refunded" })
        .eq("razorpay_order_id", orderId);
    } else {
      console.log("razorpay-webhook: unhandled event", type);
    }
  } catch (e) {
    console.error("razorpay-webhook handler error", e);
    return ok({ error: "handler" }, 500);
  }

  return ok({ received: true });
});
