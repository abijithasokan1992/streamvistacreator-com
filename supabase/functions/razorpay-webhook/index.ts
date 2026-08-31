// Razorpay webhook handler.
// Configure this URL in Razorpay Dashboard → Settings → Webhooks:
//   https://uakpqqardziifcwzvgfx.supabase.co/functions/v1/razorpay-webhook
// Set RAZORPAY_WEBHOOK_SECRET in Edge Function secrets.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hmacHex, signaturesEqual } from "../_shared/razorpay-signature.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";
import { logPayment, timer } from "../_shared/payment-logger.ts";
import { recordTrace, nowIso } from "../_shared/payment-trace.ts";
import { processEvent } from "../_shared/razorpay-webhook-handlers.ts";

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("razorpay-webhook: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return ok(
      { error: "webhook_not_configured", message: "Backend credentials are unavailable in this environment." },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const creds = await loadRazorpayCreds(supabase);
  const secret = (Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "").trim() || creds?.webhookSecret || "";
  let mode: "test" | "live" = creds?.mode ?? "test";
  if (!creds) {
    try {
      const { data } = await supabase
        .from("razorpay_config").select("mode").eq("id", true).maybeSingle();
      if (data?.mode === "live") mode = "live";
    } catch { /* ignore */ }
  }
  if (!secret) {
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook",
      action_type: "webhook.config_missing",
      error_message: "RAZORPAY_WEBHOOK_SECRET not configured",
    });
    return ok(
      {
        error: "webhook_secret_missing",
        message: "RAZORPAY_WEBHOOK_SECRET is not configured. Set it in Edge Function secrets before enabling this endpoint in the Razorpay dashboard.",
      },
      500,
    );
  }

  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  const eventIdHeader = req.headers.get("x-razorpay-event-id")
    ?? req.headers.get("x-razorpay-event_id")
    ?? "";

  const sigTimer = timer();
  const expected = await hmacHex(secret, raw);
  const signatureValid = signaturesEqual(expected, sig);

  let event: any = null;
  try { event = JSON.parse(raw); } catch (e) {
    await logPayment(supabase, {
      severity: "ERROR", source: "webhook", action_type: "webhook.parse_failed",
      error_message: e instanceof Error ? e.message : String(e),
      extra: { raw_preview: raw.slice(0, 256) },
    });
  }

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
    extra: { event_type: eventType, mode },
  });

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

  const procTimer = timer();
  try {
    await processEvent(supabase, event, creds ?? { mode });
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
