import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, EventName, type PaddleEnv } from "../_shared/paddle.ts";

const FOUNDER_EMAIL = Deno.env.get("FOUNDER_ALERT_EMAIL") || "abijithasokan@crayonspictures.com";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

/* ---------------- product catalog (in-app mapping) ---------------- */

type ProductSpec = {
  displayName: string;
  kind: "storage_block" | "creator_role" | "title_license";
  // creator_role only
  role?: "creator_pro" | "creator_studio";
  // storage_block only
  gbPerUnit?: number;
  // human price label for emails
  priceLabel: string;
  entitlementSummary: (qty: number) => string;
};

const PRODUCTS: Record<string, ProductSpec> = {
  sv_storage_block_1tb: {
    displayName: "Storage Add-on — 1 TB",
    kind: "storage_block",
    gbPerUnit: 1024,
    priceLabel: "$12.00 / month",
    entitlementSummary: (q) => `+${1024 * q} GB workspace storage`,
  },
  sv_creator_pro: {
    displayName: "Creator Pro",
    kind: "creator_role",
    role: "creator_pro",
    priceLabel: "$49.00 / month",
    entitlementSummary: () => "Creator role granted · up to 10 active titles",
  },
  sv_creator_studio: {
    displayName: "Creator Studio",
    kind: "creator_role",
    role: "creator_studio",
    priceLabel: "$199.00 / month",
    entitlementSummary: () => "Creator role granted · expanded studio limits",
  },
  sv_title_license: {
    displayName: "Title License",
    kind: "title_license",
    priceLabel: "$29.00 one-time",
    entitlementSummary: (q) => `${q} additional active title slot${q === 1 ? "" : "s"}`,
  },
};

const STORAGE_SOURCE_PREFIX = "paddle_sub:";

/* ---------------- helpers ---------------- */

async function getUser(userId: string) {
  const supabase = getSupabase();
  const [{ data: profile }, authRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("first_name,last_name,full_name,display_name,purchased_title_slots")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);
  const email = authRes.data?.user?.email || "";
  const name =
    (profile as any)?.full_name ||
    (profile as any)?.display_name ||
    [(profile as any)?.first_name, (profile as any)?.last_name].filter(Boolean).join(" ").trim() ||
    "";
  return { email, name, profile: profile as any };
}

async function notify(opts: {
  userId: string;
  productId: string;
  product: ProductSpec;
  quantity: number;
  paddleSubscriptionId?: string;
  txId?: string;
}) {
  const supabase = getSupabase();
  const { email, name } = await getUser(opts.userId);
  const occurredAt = new Date().toISOString();
  const entitlementSummary = opts.product.entitlementSummary(opts.quantity);

  // 1) buyer email
  if (email) {
    try {
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "purchase-confirmation",
          recipientEmail: email,
          idempotencyKey: `paddle-buyer-${opts.paddleSubscriptionId || opts.txId}`,
          templateData: {
            audience: "buyer",
            productName: opts.product.displayName,
            priceLabel: opts.product.priceLabel,
            quantity: opts.quantity,
            entitlementSummary,
            buyerEmail: email,
            buyerName: name,
            paddleSubscriptionId: opts.paddleSubscriptionId,
            occurredAt,
          },
        },
      });
    } catch (e) { console.error("buyer email failed", e); }
  }

  // 2) founder email
  try {
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "purchase-confirmation",
        recipientEmail: FOUNDER_EMAIL,
        idempotencyKey: `paddle-founder-${opts.paddleSubscriptionId || opts.txId}`,
        templateData: {
          audience: "founder",
          productName: opts.product.displayName,
          priceLabel: opts.product.priceLabel,
          quantity: opts.quantity,
          entitlementSummary,
          buyerEmail: email,
          buyerName: name,
          paddleSubscriptionId: opts.paddleSubscriptionId,
          occurredAt,
        },
      },
    });
  } catch (e) { console.error("founder email failed", e); }

  // 3) agent_events row for the founder dashboard
  try {
    await supabase.from("agent_events").insert({
      agent: "chief",
      severity: "info",
      title: `Paddle purchase · ${opts.product.displayName}`,
      summary: `${name || email || opts.userId} · ${entitlementSummary}`,
      payload: {
        source: "payments-webhook",
        productId: opts.productId,
        product: opts.product.displayName,
        quantity: opts.quantity,
        paddle_subscription_id: opts.paddleSubscriptionId,
        paddle_transaction_id: opts.txId,
        user_id: opts.userId,
        buyer_email: email,
      },
      created_by: opts.userId,
    });
  } catch (e) { console.error("agent_events insert failed", e); }
}

async function applyEntitlement(opts: {
  userId: string;
  productId: string;
  quantity: number;
  paddleSubscriptionId?: string;
}) {
  const product = PRODUCTS[opts.productId];
  if (!product) {
    console.warn("Unknown product, no entitlement applied", opts.productId);
    return null;
  }
  const supabase = getSupabase();

  if (product.kind === "storage_block") {
    const gb = (product.gbPerUnit || 0) * Math.max(1, opts.quantity);
    const source = `${STORAGE_SOURCE_PREFIX}${opts.paddleSubscriptionId}`;
    // Upsert-by-paddle_sub: delete prior row for this sub before inserting fresh
    if (opts.paddleSubscriptionId) {
      await supabase.from("storage_allocations").delete()
        .eq("user_id", opts.userId)
        .eq("source", source);
    }
    await supabase.from("storage_allocations").insert({
      user_id: opts.userId,
      allocated_gb: gb,
      source,
      notes: `Paddle subscription ${opts.paddleSubscriptionId} · ${opts.quantity}× 1 TB block`,
    });
  } else if (product.kind === "creator_role") {
    await supabase.rpc("grant_creator_role", { _user_id: opts.userId });
  } else if (product.kind === "title_license") {
    // Increment counter
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("purchased_title_slots")
      .eq("user_id", opts.userId)
      .maybeSingle();
    const current = Number((prof as any)?.purchased_title_slots || 0);
    await supabase
      .from("user_profiles")
      .update({ purchased_title_slots: current + Math.max(1, opts.quantity), updated_at: new Date().toISOString() })
      .eq("user_id", opts.userId);
  }
  return product;
}

async function revokeEntitlement(opts: {
  userId: string;
  productId: string;
  paddleSubscriptionId: string;
}) {
  const product = PRODUCTS[opts.productId];
  if (!product) return;
  const supabase = getSupabase();
  if (product.kind === "storage_block") {
    const source = `${STORAGE_SOURCE_PREFIX}${opts.paddleSubscriptionId}`;
    await supabase.from("storage_allocations").delete()
      .eq("user_id", opts.userId)
      .eq("source", source);
  } else if (product.kind === "creator_role") {
    // Only revoke if no other active managed sub exists for this user
    const { data: others } = await supabase
      .from("subscriptions")
      .select("id,product_id,status")
      .eq("user_id", opts.userId)
      .in("status", ["active", "trialing", "past_due"]);
    const stillHas = (others || []).some((r: any) =>
      (r.product_id === "sv_creator_pro" || r.product_id === "sv_creator_studio") &&
      r.product_id !== opts.productId,
    );
    if (!stillHas) {
      await supabase.rpc("revoke_creator_role", { _user_id: opts.userId });
    }
  }
  // Title licenses are one-time and not refundable on cancel events.
}

/* ---------------- event handlers ---------------- */

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;
  if (!userId) { console.error("No userId in customData; skipping"); return; }
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  const quantity = Number(item?.quantity || 1);
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item?.price?.id, rawProductId: item?.product?.id,
    });
    return;
  }

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: id,
      paddle_customer_id: customerId,
      product_id: productId,
      price_id: priceId,
      status,
      provider: "paddle",
      gateway: "paddle",
      subscription_type: productId === "sv_storage_block_1tb" ? "storage" : "creator",
      storage_quantity_tb: productId === "sv_storage_block_1tb" ? quantity : null,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" },
  );

  const product = await applyEntitlement({ userId, productId, quantity, paddleSubscriptionId: id });
  if (product) {
    await notify({ userId, productId, product, quantity, paddleSubscriptionId: id });
  }
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;
  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  // If subscription is now past_due/paused/canceled and period has ended, revoke.
  const periodEnd = currentBillingPeriod?.endsAt ? new Date(currentBillingPeriod.endsAt).getTime() : 0;
  const expired = periodEnd && periodEnd < Date.now();
  if ((status === "canceled" || status === "paused") && expired) {
    const sub = await getSupabase()
      .from("subscriptions").select("user_id,product_id").eq("paddle_subscription_id", id).maybeSingle();
    const userId = (sub.data as any)?.user_id;
    const productId = (sub.data as any)?.product_id || items?.[0]?.product?.importMeta?.externalId;
    if (userId && productId) {
      await revokeEntitlement({ userId, productId, paddleSubscriptionId: id });
    }
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const { id, currentBillingPeriod } = data;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  // Revoke immediately only if period already over; otherwise allow access until period end.
  const periodEnd = currentBillingPeriod?.endsAt ? new Date(currentBillingPeriod.endsAt).getTime() : 0;
  if (periodEnd && periodEnd < Date.now()) {
    const sub = await getSupabase()
      .from("subscriptions").select("user_id,product_id").eq("paddle_subscription_id", id).maybeSingle();
    const userId = (sub.data as any)?.user_id;
    const productId = (sub.data as any)?.product_id;
    if (userId && productId) {
      await revokeEntitlement({ userId, productId, paddleSubscriptionId: id });
    }
  }
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  // Used for one-time products (e.g. sv_title_license). For subscription renewals
  // and initial subs, the subscription events already drive entitlement.
  const { id, customData, items, subscriptionId } = data;
  if (subscriptionId) return; // subscription path handles it
  const userId = customData?.userId;
  if (!userId) return;
  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  // Transaction events don't include product object; derive productId via PRODUCTS map by priceId.
  let productId: string | undefined;
  if (priceId) {
    productId = Object.keys(PRODUCTS).find((pid) =>
      // simple convention: priceId starts with productId
      priceId.startsWith(pid),
    );
  }
  if (!productId) {
    console.warn("transaction.completed: cannot resolve productId", { priceId });
    return;
  }
  const quantity = Number(item?.quantity || 1);
  const product = await applyEntitlement({ userId, productId, quantity, paddleSubscriptionId: id });
  if (product) {
    // log a row for visibility
    await getSupabase().from("subscriptions").insert({
      user_id: userId,
      paddle_subscription_id: `tx_${id}`,
      paddle_customer_id: data.customerId || "",
      product_id: productId,
      price_id: priceId || productId,
      status: "completed",
      provider: "paddle",
      gateway: "paddle",
      subscription_type: "one_time",
      environment: env,
    });
    await notify({ userId, productId, product, quantity, txId: id });
  }
  void env;
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env); break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env); break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env); break;
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env); break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
  try {
    await handleWebhook(req, env);
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
