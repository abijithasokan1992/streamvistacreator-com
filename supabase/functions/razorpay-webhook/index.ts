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
import { logPayment, timer } from "../_shared/payment-logger.ts";
import { recordTrace, nowIso } from "../_shared/payment-trace.ts";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
  const topupIdFromNotes: string | null =
    payment?.notes?.topup_id ?? order?.notes?.topup_id ?? null;

  // ── One-shot payment & top-up handlers ──────────────
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

    // Canonical projection for storage top-ups (idempotent).
    let topupRow: any = null;
    if (topupIdFromNotes) {
      const { data } = await supabase
        .from("storage_topups").select("*").eq("id", topupIdFromNotes).maybeSingle();
      topupRow = data;
    }
    if (!topupRow && orderId) {
      const { data } = await supabase
        .from("storage_topups").select("*").eq("razorpay_order_id", orderId).maybeSingle();
      topupRow = data;
    }
    if (topupRow) {
      // Amount sanity check
      const expectedPaise = Math.round(Number(topupRow.amount_inr) * 100);
      const paidPaise = Number(payment?.amount ?? order?.amount ?? 0);
      if (paidPaise && expectedPaise && Math.abs(paidPaise - expectedPaise) > 1) {
        await logPayment(supabase, {
          severity: "ERROR", source: "webhook", action_type: "payment.amount_mismatch",
          order_id: orderId, payment_id: payment?.id ?? null,
          error_message: `Expected ${expectedPaise} paise, got ${paidPaise}`,
          extra: { topup_id: topupRow.id },
        });
      }

      if (topupRow.status !== "paid") {
        await supabase.from("storage_topups")
          .update({ status: "paid", razorpay_payment_id: payment?.id ?? null })
          .eq("id", topupRow.id);
      }
      const { error: projErr, data: proj } = await supabase
        .rpc("project_topup_entitlement", { _topup_id: topupRow.id });
      if (projErr) {
        await logPayment(supabase, {
          severity: "ERROR", source: "webhook", action_type: "entitlement.projection_failed",
          order_id: orderId, payment_id: payment?.id ?? null,
          error_message: projErr.message, extra: { topup_id: topupRow.id },
        });
      } else {
        await logPayment(supabase, {
          severity: "INFO", source: "webhook", action_type: "entitlement.projected",
          order_id: orderId, payment_id: payment?.id ?? null,
          extra: { topup_id: topupRow.id, invoice_id: (proj as any)?.invoice_id },
        });
      }
    } else if (!subscription?.id) {
      // Unknown order with no matching topup or subscription
      await logPayment(supabase, {
        severity: "WARN", source: "webhook", action_type: "payment.unknown_mapping",
        order_id: orderId, payment_id: payment?.id ?? null,
        error_message: "No topup, subscription or onboarding row mapped to this order",
      });
    }
  } else if (orderId && type === "payment.failed") {
    await supabase
      .from("onboarding_requests")
      .update({ payment_status: "failed" })
      .eq("razorpay_order_id", orderId);
    await supabase
      .from("storage_topups")
      .update({ status: "failed" })
      .eq("razorpay_order_id", orderId)
      .neq("status", "paid");
  } else if (orderId && type === "refund.processed") {
    await supabase
      .from("onboarding_requests")
      .update({ payment_status: "refunded" })
      .eq("razorpay_order_id", orderId);
    await supabase
      .from("invoices")
      .update({ status: "refunded" })
      .eq("razorpay_order_id", orderId);
  }

  // ── Subscription lifecycle ─────────────────
  if (subscription?.id && type?.startsWith("subscription.")) {
    const userId = subscription.notes?.userId ?? null;
    const status: string = subscription.status ?? "unknown";

    const currentStart = subscription.current_start
      ? new Date(subscription.current_start * 1000).toISOString()
      : null;
    const currentEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null;

    const razorpayCustomerId =
      subscription.customer_id ?? payment?.customer_id ?? null;
    const razorpayTokenId = payment?.token_id ?? null;

    // Subscription type comes from notes (set by create-razorpay-subscription) and
    // distinguishes Creator-storage recurring add-ons from any future plan subs.
    const subscriptionType: string =
      subscription.notes?.subscription_type ?? "creator";
    const isStorageSub = subscriptionType === "creator_storage";
    const storageQtyTb = Number(subscription.quantity ?? 0) || null;

    const { error: subErr } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        razorpay_subscription_id: subscription.id,
        razorpay_plan_id: subscription.plan_id ?? null,
        razorpay_customer_id: razorpayCustomerId,
        ...(razorpayTokenId ? { razorpay_token_id: razorpayTokenId } : {}),
        price_id: isStorageSub ? "cloudx_creator_storage" : "cloudx_creator",
        subscription_type: subscriptionType,
        ...(isStorageSub && storageQtyTb ? { storage_quantity_tb: storageQtyTb } : {}),
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
    if (subErr) {
      await logPayment(supabase, {
        severity: "ERROR", source: "webhook", action_type: "subscription.mapping_failed",
        order_id: orderId, payment_id: payment?.id ?? null,
        error_message: subErr.message,
        extra: { subscription_id: subscription.id, user_id: userId },
      });
    }

    if (razorpayCustomerId || razorpayTokenId) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (razorpayCustomerId) patch.razorpay_customer_id = razorpayCustomerId;
      if (razorpayTokenId) patch.razorpay_token_id = razorpayTokenId;
      await supabase
        .from("subscriptions")
        .update(patch)
        .eq("razorpay_subscription_id", subscription.id);
    }

    // Role grants are reserved for Creator plan subscriptions, NOT for storage add-ons.
    // Creator plans are founder-assisted in this pass — storage subs do not toggle role.
    if (userId && !isStorageSub) {
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
    await logPayment(supabase, {
      severity: "WARN", source: "webhook", action_type: "payment.unknown_mapping",
      error_message: `Unhandled event ${type} with no order/subscription id`,
    });
  }
}

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
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook",
      action_type: "webhook.config_missing",
      error_message: "RAZORPAY_WEBHOOK_SECRET not configured",
    });
    return ok({ error: "unavailable" }, 503);
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const eventIdHeader = req.headers.get("x-razorpay-event-id")
    ?? req.headers.get("x-razorpay-event_id")
    ?? "";

  // ── Signature verification ─────────────────────────────
  const sigTimer = timer();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  let signatureValid = false;
  try {
    const a = new TextEncoder().encode(sig);
    const b = new TextEncoder().encode(expected);
    signatureValid = a.byteLength === b.byteLength && timingSafeEqual(a, b);
  } catch { signatureValid = false; }

  let event: any = null;
  try { event = JSON.parse(raw); } catch (e) {
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook", action_type: "webhook.parse_failed",
      error_message: e instanceof Error ? e.message : String(e),
      extra: { raw_preview: raw.slice(0, 256) },
    });
  }

  // Derive the canonical event id (prefer the header, fall back to body id).
  const eventId = eventIdHeader || event?.id || `derived_${expected.slice(0, 16)}_${event?.event ?? "unknown"}`;
  const eventType = event?.event ?? "unknown";
  const payment = event?.payload?.payment?.entity;
  const order = event?.payload?.order?.entity;
  const subscription = event?.payload?.subscription?.entity;
  const orderId = payment?.order_id ?? order?.id ?? null;
  const paymentId = payment?.id ?? null;

  await logPayment(supabase, {
    severity: signatureValid ? "INFO" : "ERROR",
    source: "webhook",
    action_type: "webhook.signature",
    event_id: eventId,
    order_id: orderId,
    payment_id: paymentId,
    duration_ms: sigTimer(),
    error_message: signatureValid ? null : "Signature mismatch",
    extra: { event_type: eventType, mode: creds.mode },
  });

  // Legacy audit log (kept for existing admin UI).
  try {
    await supabase.from("razorpay_audit_log").insert({
      event_type: eventType,
      source: "webhook",
      order_id: orderId,
      payment_id: paymentId,
      subscription_id: subscription?.id ?? null,
      amount_paise: payment?.amount ?? order?.amount ?? null,
      currency: payment?.currency ?? order?.currency ?? null,
      status: payment?.status ?? order?.status ?? subscription?.status ?? null,
      error_code: payment?.error_code ?? null,
      error_description: payment?.error_description ?? null,
      signature_valid: signatureValid,
      user_id: subscription?.notes?.userId ?? null,
      payload: event ?? { raw: raw.slice(0, 4000) },
    });
  } catch (e) { console.error("razorpay-webhook: audit insert failed", e); }

  // Forensic trace: record receipt of webhook for this order.
  await recordTrace(supabase, orderId, {
    payment_id: paymentId,
    webhook_event: eventType,
    webhook_signature_valid: signatureValid,
    webhook_received_at: nowIso(),
    razorpay_payment_status: payment?.status ?? null,
    razorpay_order_status: order?.status ?? null,
    amount_paise: payment?.amount != null ? String(payment.amount) : (order?.amount != null ? String(order.amount) : null),
    currency: payment?.currency ?? order?.currency ?? null,
    extra: { event_id: eventId, error_code: payment?.error_code ?? null, error_description: payment?.error_description ?? null },
  });

  if (!signatureValid) return ok({ error: "invalid signature" }, 400);
  if (!event) return ok({ error: "bad json" }, 400);

  // ── Idempotent ledger: insert pending; if a 'processed' row already
  // exists for this event_id, return 200 immediately and skip side-effects.
  const ledgerTimer = timer();
  const { data: existing, error: existingErr } = await supabase
    .from("razorpay_webhook_ledger")
    .select("id, status, retry_count")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingErr) {
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook", action_type: "webhook.ledger.lookup_failed",
      event_id: eventId, order_id: orderId, payment_id: paymentId,
      error_message: existingErr.message, duration_ms: ledgerTimer(),
    });
  }

  if (existing?.status === "processed") {
    await logPayment(supabase, {
      severity: "INFO", source: "webhook", action_type: "webhook.replay_skipped",
      event_id: eventId, order_id: orderId, payment_id: paymentId,
      duration_ms: ledgerTimer(),
      extra: { reason: "already_processed", event_type: eventType },
    });
    return ok({ received: true, replay: true });
  }

  let ledgerRowId: string | null = existing?.id ?? null;
  if (!existing) {
    const { data: inserted, error: insErr } = await supabase
      .from("razorpay_webhook_ledger")
      .insert({
        event_id: eventId,
        event_type: eventType,
        payment_id: paymentId,
        order_id: orderId,
        subscription_id: subscription?.id ?? null,
        status: "pending",
        signature_valid: signatureValid,
        payload: event,
        last_attempt_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insErr) {
      await logPayment(supabase, {
        severity: "ERROR", source: "webhook", action_type: "webhook.ledger.insert_failed",
        event_id: eventId, order_id: orderId, payment_id: paymentId,
        error_message: insErr.message, duration_ms: ledgerTimer(),
      });
    } else {
      ledgerRowId = inserted?.id ?? null;
    }
  } else {
    await supabase
      .from("razorpay_webhook_ledger")
      .update({
        last_attempt_at: new Date().toISOString(),
        retry_count: (existing.retry_count ?? 0) + 1,
        status: "pending",
        error_message: null,
      })
      .eq("id", existing.id);
  }

  await logPayment(supabase, {
    severity: "INFO", source: "webhook", action_type: "webhook.ledger.ingested",
    event_id: eventId, order_id: orderId, payment_id: paymentId,
    duration_ms: ledgerTimer(),
    extra: { event_type: eventType, replay: !!existing },
  });

  // ── Apply event side-effects with try/catch so failures are recorded. ─
  const procTimer = timer();
  try {
    await processEvent(supabase, event, creds);
    if (ledgerRowId) {
      await supabase
        .from("razorpay_webhook_ledger")
        .update({ status: "processed", processed_at: new Date().toISOString(), error_message: null })
        .eq("id", ledgerRowId);
    }
    await logPayment(supabase, {
      severity: "INFO", source: "webhook", action_type: "webhook.processed",
      event_id: eventId, order_id: orderId, payment_id: paymentId,
      duration_ms: procTimer(),
      extra: { event_type: eventType },
    });
    await recordTrace(supabase, orderId, {
      final_result: eventType === "payment.failed" ? "payment_failed_webhook" : "webhook_processed",
      extra: { processed_ms: procTimer() },
    });
    return ok({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (ledgerRowId) {
      await supabase
        .from("razorpay_webhook_ledger")
        .update({ status: "failed", error_message: msg })
        .eq("id", ledgerRowId);
    }
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook", action_type: "webhook.processing_failed",
      event_id: eventId, order_id: orderId, payment_id: paymentId,
      error_message: msg, duration_ms: procTimer(),
      extra: { event_type: eventType },
    });
    await recordTrace(supabase, orderId, {
      final_result: "webhook_processing_failed",
      last_error: msg,
    });
    return ok({ received: true, queued_for_retry: true });
  }
});
