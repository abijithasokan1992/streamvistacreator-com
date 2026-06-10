// Razorpay webhook handler.
// Configure this URL in Razorpay Dashboard → Settings → Webhooks:
//   https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/razorpay-webhook
// Subscribed events:
//   payment.captured, payment.failed, order.paid, refund.processed,
//   subscription.activated, subscription.charged, subscription.halted,
//   subscription.cancelled, subscription.completed, subscription.paused, subscription.resumed
// Set the webhook secret as RAZORPAY_WEBHOOK_SECRET in edge function secrets
// (or via the razorpay_config table).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac, timingSafeEqual } from "node:crypto";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ACTIVE_STATUSES = new Set(["active", "authenticated"]);
const INACTIVE_STATUSES = new Set(["halted", "cancelled", "completed", "expired"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("razorpay-webhook: missing env");
    return ok({ error: "unavailable" }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const creds = await loadRazorpayCreds(supabase);
  const secret = creds?.webhookSecret;
  if (!secret) {
    console.error("razorpay-webhook: webhook secret not configured");
    return ok({ error: "unavailable" }, 503);
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");

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

  const type = event?.event as string;
  const payment = event?.payload?.payment?.entity;
  const order = event?.payload?.order?.entity;
  const subscription = event?.payload?.subscription?.entity;
  const orderId = payment?.order_id ?? order?.id;

  try {
    // ── One-shot payment & top-up handlers (existing flow) ──────────────
    if (orderId && (type === "payment.captured" || type === "order.paid")) {
      await supabase
        .from("onboarding_requests")
        .update({
          payment_status: "paid",
          onboarding_status: "paid",
          razorpay_payment_id: payment?.id ?? null,
          amount_paid_paise: payment?.amount ?? order?.amount ?? null,
        })
        .eq("razorpay_order_id", orderId);
    } else if (orderId && type === "payment.failed") {
      await supabase
        .from("onboarding_requests")
        .update({ payment_status: "failed" })
        .eq("razorpay_order_id", orderId);
    } else if (orderId && type === "refund.processed") {
      await supabase
        .from("onboarding_requests")
        .update({ payment_status: "refunded" })
        .eq("razorpay_order_id", orderId);
    }

    // ── Subscription lifecycle (Creator recurring plan) ─────────────────
    if (subscription?.id && type?.startsWith("subscription.")) {
      const userId = subscription.notes?.userId ?? null;
      const status: string = subscription.status ?? "unknown";

      const currentStart = subscription.current_start
        ? new Date(subscription.current_start * 1000).toISOString()
        : null;
      const currentEnd = subscription.current_end
        ? new Date(subscription.current_end * 1000).toISOString()
        : null;

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          razorpay_subscription_id: subscription.id,
          razorpay_plan_id: subscription.plan_id ?? null,
          price_id: "cloudx_creator",
          status,
          current_period_start: currentStart,
          current_period_end: currentEnd,
          cancel_at_period_end: status === "cancelled" || status === "completed",
          environment: creds.mode === "live" ? "live" : "sandbox",
          gateway: "razorpay",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "razorpay_subscription_id" },
      );

      if (userId) {
        if (type === "subscription.activated" ||
            type === "subscription.charged" ||
            type === "subscription.resumed" ||
            ACTIVE_STATUSES.has(status)) {
          await supabase.rpc("grant_creator_role", { _user_id: userId });
        } else if (type === "subscription.cancelled" ||
                   type === "subscription.halted" ||
                   type === "subscription.completed" ||
                   INACTIVE_STATUSES.has(status)) {
          await supabase.rpc("revoke_creator_role", { _user_id: userId });
        }
      }
    }

    if (!orderId && !subscription?.id) {
      console.log("razorpay-webhook: unhandled event", type);
    }
  } catch (e) {
    console.error("razorpay-webhook handler error", e);
    return ok({ error: "handler" }, 500);
  }

  return ok({ received: true });
});
