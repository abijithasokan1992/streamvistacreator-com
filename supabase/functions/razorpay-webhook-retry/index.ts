// Admin-only manual retry for failed Razorpay webhook events.
// Re-parses the exact payload stored in razorpay_webhook_ledger and re-runs
// the side-effects, then marks the ledger row 'processed' on success.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";
import { logPayment, timer } from "../_shared/payment-logger.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

const ACTIVE_STATUSES = new Set(["active", "authenticated"]);
const INACTIVE_STATUSES = new Set(["halted", "cancelled", "completed", "expired"]);

async function processEvent(supabase: any, event: any, creds: any): Promise<void> {
  const type = event?.event as string;
  const payment = event?.payload?.payment?.entity;
  const order = event?.payload?.order?.entity;
  const subscription = event?.payload?.subscription?.entity;
  const orderId = payment?.order_id ?? order?.id;

  if (orderId && (type === "payment.captured" || type === "order.paid")) {
    await supabase.from("onboarding_requests").update({
      payment_status: "paid",
      onboarding_status: "paid",
      razorpay_payment_id: payment?.id ?? null,
      amount_paid_paise: payment?.amount ?? order?.amount ?? null,
    }).eq("razorpay_order_id", orderId);
  } else if (orderId && type === "payment.failed") {
    await supabase.from("onboarding_requests").update({ payment_status: "failed" }).eq("razorpay_order_id", orderId);
  } else if (orderId && type === "refund.processed") {
    await supabase.from("onboarding_requests").update({ payment_status: "refunded" }).eq("razorpay_order_id", orderId);
  }

  if (subscription?.id && type?.startsWith("subscription.")) {
    const userId = subscription.notes?.userId ?? null;
    const status: string = subscription.status ?? "unknown";
    const currentStart = subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null;
    const currentEnd = subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null;
    const razorpayCustomerId = subscription.customer_id ?? payment?.customer_id ?? null;
    const razorpayTokenId = payment?.token_id ?? null;

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: subscription.plan_id ?? null,
      razorpay_customer_id: razorpayCustomerId,
      ...(razorpayTokenId ? { razorpay_token_id: razorpayTokenId } : {}),
      price_id: "cloudx_creator",
      status,
      current_period_start: currentStart,
      current_period_end: currentEnd,
      cancel_at_period_end: status === "cancelled" || status === "completed",
      environment: creds.mode === "live" ? "live" : "sandbox",
      gateway: "razorpay",
      updated_at: new Date().toISOString(),
    }, { onConflict: "razorpay_subscription_id" });

    if (userId) {
      if (type === "subscription.activated" || type === "subscription.charged" || type === "subscription.resumed" || ACTIVE_STATUSES.has(status)) {
        await supabase.rpc("grant_creator_role", { _user_id: userId });
      } else if (type === "subscription.cancelled" || type === "subscription.halted" || type === "subscription.completed" || INACTIVE_STATUSES.has(status)) {
        await supabase.rpc("revoke_creator_role", { _user_id: userId });
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

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

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json(req, { error: "Forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const eventId = String(body?.event_id ?? "").trim();
  const ledgerId = String(body?.ledger_id ?? "").trim();
  if (!eventId && !ledgerId) return json(req, { error: "event_id or ledger_id required" }, 400);

  const q = supabase.from("razorpay_webhook_ledger").select("*").limit(1);
  const { data: rows, error: lookupErr } = ledgerId
    ? await q.eq("id", ledgerId)
    : await q.eq("event_id", eventId);
  if (lookupErr || !rows || rows.length === 0) {
    return json(req, { error: "Ledger row not found" }, 404);
  }
  const row = rows[0] as any;

  if (row.status === "processed") {
    return json(req, { ok: true, already: true, status: "processed" });
  }

  const creds = await loadRazorpayCreds(supabase);
  if (!creds) return json(req, { error: "Razorpay not configured" }, 503);

  await supabase
    .from("razorpay_webhook_ledger")
    .update({
      status: "pending",
      retry_count: (row.retry_count ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", row.id);

  const t = timer();
  try {
    await processEvent(supabase, row.payload, creds);
    await supabase
      .from("razorpay_webhook_ledger")
      .update({ status: "processed", processed_at: new Date().toISOString(), error_message: null })
      .eq("id", row.id);
    await logPayment(supabase, {
      severity: "INFO", source: "admin", action_type: "webhook.retry.processed",
      event_id: row.event_id, order_id: row.order_id, payment_id: row.payment_id,
      user_id: userId, duration_ms: t(),
      extra: { ledger_id: row.id, event_type: row.event_type },
    });
    return json(req, { ok: true, status: "processed", retry_count: (row.retry_count ?? 0) + 1 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("razorpay_webhook_ledger")
      .update({ status: "failed", error_message: msg })
      .eq("id", row.id);
    await logPayment(supabase, {
      severity: "ERROR", source: "admin", action_type: "webhook.retry.failed",
      event_id: row.event_id, order_id: row.order_id, payment_id: row.payment_id,
      user_id: userId, error_message: msg, duration_ms: t(),
      extra: { ledger_id: row.id, event_type: row.event_type },
    });
    return json(req, { ok: false, error: msg }, 500);
  }
});
