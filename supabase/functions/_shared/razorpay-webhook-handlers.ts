// Shared Razorpay webhook side-effects.
import { logPayment } from "./payment-logger.ts";

const ACTIVE_STATUSES = new Set(["active", "authenticated"]);
const INACTIVE_STATUSES = new Set(["halted", "cancelled", "completed", "expired"]);
const MASTER_ADMIN_EMAIL = "abijithasokan@crayonspictures.com";

async function resolveMasterAdminEmail(supabase: any): Promise<string> {
  const envOverride = (Deno.env.get("FOUNDER_ALERT_EMAIL") ?? "").trim();
  if (envOverride && /@/.test(envOverride)) return envOverride;
  try {
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "founder_email").maybeSingle();
    const v = typeof data?.value === "string" ? data.value : String(data?.value ?? "");
    const parsed = v.replace(/^"|"$/g, "").trim();
    if (parsed && /@/.test(parsed)) return parsed;
  } catch { /* ignore */ }
  return MASTER_ADMIN_EMAIL;
}

async function projectToBillingOrders(supabase: any, event: any): Promise<void> {
  const type = event?.event as string;
  const payment = event?.payload?.payment?.entity ?? null;
  const order = event?.payload?.order?.entity ?? null;
  const orderId: string | null = payment?.order_id ?? order?.id ?? null;
  if (!orderId) return;
  let nextStatus: string | null = null;
  if (type === "payment.captured" || type === "order.paid") nextStatus = "paid";
  else if (type === "payment.failed") nextStatus = "failed";
  else if (type === "refund.processed") nextStatus = "refunded";
  if (!nextStatus) return;
  const notesBillingOrderId = payment?.notes?.billing_order_id ?? order?.notes?.billing_order_id ?? null;
  const customerUserId = payment?.notes?.userId ?? order?.notes?.userId ?? null;
  const amountPaise = Number(payment?.amount ?? order?.amount ?? 0) || null;
  const currency = String(payment?.currency ?? order?.currency ?? "INR");
  let existing: any = null;
  if (notesBillingOrderId) {
    const { data } = await supabase.from("billing_orders").select("id,status").eq("id", notesBillingOrderId).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await supabase.from("billing_orders").select("id,status").eq("source_type", "razorpay_order").eq("source_ref_id", orderId).maybeSingle();
    existing = data;
  }
  const patch = {
    status: nextStatus,
    metadata: {
      razorpay_event: type,
      razorpay_payment_id: payment?.id ?? null,
      razorpay_order_id: orderId,
      razorpay_status: payment?.status ?? order?.status ?? null,
      updated_via: "webhook",
    },
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    if (existing.status === "paid" && nextStatus === "failed") return;
    if (existing.status === "refunded" && nextStatus !== "refunded") return;
    await supabase.from("billing_orders").update(patch).eq("id", existing.id);
    return;
  }
  await supabase.from("billing_orders").insert({
    app_key: "streamvista",
    customer_user_id: customerUserId,
    source_type: "razorpay_order",
    source_ref_id: orderId,
    amount_subtotal_paise: amountPaise,
    amount_tax_paise: 0,
    amount_total_paise: amountPaise,
    currency,
    status: nextStatus,
    payment_method_mode: "razorpay",
    metadata: patch.metadata,
  });
}

export async function processEvent(supabase: any, event: any, creds: any): Promise<void> {
  try { await projectToBillingOrders(supabase, event); } catch (e) {
    console.error("razorpay-webhook: billing_orders projection failed", e);
  }

  const type = event?.event as string;
  const payment = event?.payload?.payment?.entity;
  const order = event?.payload?.order?.entity;
  const subscription = event?.payload?.subscription?.entity;
  const orderId = payment?.order_id ?? order?.id;
  const topupIdFromNotes: string | null = payment?.notes?.topup_id ?? order?.notes?.topup_id ?? null;

  if (orderId && (type === "payment.captured" || type === "order.paid")) {
    await supabase.from("onboarding_requests").update({
      payment_status: "paid",
      onboarding_status: "paid",
      razorpay_payment_id: payment?.id ?? null,
      amount_paid_paise: payment?.amount ?? order?.amount ?? null,
    }).eq("razorpay_order_id", orderId);

    let topupRow: any = null;
    if (topupIdFromNotes) {
      const { data } = await supabase.from("storage_topups").select("*").eq("id", topupIdFromNotes).maybeSingle();
      topupRow = data;
    }
    if (!topupRow && orderId) {
      const { data } = await supabase.from("storage_topups").select("*").eq("razorpay_order_id", orderId).maybeSingle();
      topupRow = data;
    }
    if (topupRow) {
      if (topupRow.status !== "paid") {
        await supabase.from("storage_topups").update({ status: "paid", razorpay_payment_id: payment?.id ?? null }).eq("id", topupRow.id);
      }
      const { error: projErr } = await supabase.rpc("project_topup_entitlement", { _topup_id: topupRow.id });
      if (projErr) {
        await logPayment(supabase, {
          severity: "ERROR", source: "webhook", action_type: "entitlement.projection_failed",
          order_id: orderId, payment_id: payment?.id ?? null, error_message: projErr.message,
          extra: { topup_id: topupRow.id },
        });
      }
    }
  } else if (orderId && type === "payment.failed") {
    await supabase.from("onboarding_requests").update({ payment_status: "failed" }).eq("razorpay_order_id", orderId);
    await supabase.from("storage_topups").update({ status: "failed" }).eq("razorpay_order_id", orderId).neq("status", "paid");
  } else if (orderId && type === "refund.processed") {
    await supabase.from("onboarding_requests").update({ payment_status: "refunded" }).eq("razorpay_order_id", orderId);
    await supabase.from("invoices").update({ status: "refunded" }).eq("razorpay_order_id", orderId);
  }

  if (subscription?.id && type?.startsWith("subscription.")) {
    const userId = subscription.notes?.userId ?? null;
    const status: string = subscription.status ?? "unknown";
    const currentStart = subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : null;
    const currentEnd = subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null;
    const subscriptionType: string = subscription.notes?.subscription_type ?? "creator";
    const isStorageSub = subscriptionType === "creator_storage";
    const storageQtyTb = Number(subscription.quantity ?? 0) || null;
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: subscription.plan_id ?? null,
      razorpay_customer_id: subscription.customer_id ?? payment?.customer_id ?? null,
      price_id: isStorageSub ? "cloudx_creator_storage" : "cloudx_creator",
      subscription_type: subscriptionType,
      ...(isStorageSub && storageQtyTb ? { storage_quantity_tb: storageQtyTb } : {}),
      status,
      current_period_start: currentStart,
      current_period_end: currentEnd,
      cancel_at_period_end: status === "cancelled" || status === "completed",
      environment: creds?.mode === "live" ? "live" : "sandbox",
      gateway: "razorpay",
      updated_at: new Date().toISOString(),
    }, { onConflict: "razorpay_subscription_id" });

    if (userId && !isStorageSub) {
      if (type === "subscription.activated" || type === "subscription.charged" || type === "subscription.resumed" || ACTIVE_STATUSES.has(status)) {
        await supabase.rpc("grant_creator_role", { _user_id: userId });
      } else if (type === "subscription.cancelled" || type === "subscription.halted" || type === "subscription.completed" || INACTIVE_STATUSES.has(status)) {
        await supabase.rpc("revoke_creator_role", { _user_id: userId });
      }
    }
  }

  if (!orderId && !subscription?.id) {
    await logPayment(supabase, {
      severity: "WARN", source: "webhook", action_type: "payment.unknown_mapping",
      error_message: `Unhandled event ${type} with no order/subscription id`,
    });
    try {
      const founderEmail = await resolveMasterAdminEmail(supabase);
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "purchase-confirmation",
          recipientEmail: founderEmail,
          idempotencyKey: `rzp-orphan-${type}-${Date.now()}`,
          templateData: {
            audience: "founder",
            productName: `Unmapped Razorpay event · ${type}`,
            priceLabel: "n/a",
            quantity: 1,
            entitlementSummary: "No local order or subscription matched this event.",
            buyerEmail: "unknown",
            buyerName: "",
            occurredAt: new Date().toISOString(),
          },
        },
      });
    } catch (e) {
      console.error("razorpay orphan-event notify failed", e);
    }
  }
}
