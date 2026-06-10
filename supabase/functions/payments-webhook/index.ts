import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

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

const ACTIVE = new Set(["active", "trialing"]);
const INACTIVE = new Set(["canceled", "incomplete_expired", "unpaid"]);

function isCreatorPrice(priceId?: string | null): boolean {
  if (!priceId) return false;
  return priceId === "cloudx_creator" || priceId.startsWith("cloudx_");
}

async function upsertSub(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId ?? null;
  const item = subscription.items?.data?.[0];
  const priceId =
    item?.price?.lookup_key ||
    item?.price?.metadata?.lovable_external_id ||
    item?.price?.id;
  const productId = item?.price?.product;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      gateway: "stripe",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  // Role management: grant creator on active Creator subscription.
  if (userId && isCreatorPrice(priceId)) {
    if (ACTIVE.has(subscription.status)) {
      await getSupabase().rpc("grant_creator_role", { _user_id: userId });
    } else if (INACTIVE.has(subscription.status)) {
      await getSupabase().rpc("revoke_creator_role", { _user_id: userId });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), { status: 200 });
  }
  const env: StripeEnv = rawEnv;
  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSub(event.data.object, env);
        break;
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        await getSupabase()
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id)
          .eq("environment", env);
        if (sub.metadata?.userId) {
          await getSupabase().rpc("revoke_creator_role", { _user_id: sub.metadata.userId });
        }
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
