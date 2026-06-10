// Auto-bills pending usage_overages to the user's saved Stripe payment method.
// Razorpay tokenisation requires a per-user mandate; for Razorpay users we
// keep the row as pending and surface it for manual invoicing in the admin.
// Master switch lives in billing_config.auto_charge_enabled (defaults OFF).
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createStripeClient } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  try {
    const supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: cfg } = await supa.from("billing_config").select("auto_charge_enabled").eq("id", 1).single();
    if (!cfg?.auto_charge_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "auto_charge_disabled" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: rows, error } = await supa
      .from("usage_overages")
      .select("id, user_id, amount_paise, period_start, kind")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    let charged = 0;
    let failed = 0;
    let revenuePaise = 0;

    for (const row of rows ?? []) {
      // Find the user's Stripe customer
      const { data: sub } = await supa
        .from("subscriptions")
        .select("stripe_customer_id, environment")
        .eq("user_id", row.user_id)
        .not("stripe_customer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.stripe_customer_id) {
        await supa.from("usage_overages").update({
          status: "failed", failure_reason: "no_saved_payment_method",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        failed++;
        continue;
      }

      try {
        const stripe = createStripeClient((sub.environment as "sandbox" | "live") ?? "sandbox");
        const pms = await stripe.paymentMethods.list({ customer: sub.stripe_customer_id, type: "card", limit: 1 });
        const pmId = pms.data[0]?.id;
        if (!pmId) throw new Error("no_card_on_file");

        const intent = await stripe.paymentIntents.create({
          amount: row.amount_paise,
          currency: "inr",
          customer: sub.stripe_customer_id,
          payment_method: pmId,
          off_session: true,
          confirm: true,
          description: `StreamVista overage · ${row.kind} · ${row.period_start}`,
          metadata: { overage_id: row.id, user_id: row.user_id, kind: row.kind },
        });

        if (intent.status === "succeeded") {
          await supa.from("usage_overages").update({
            status: "charged", charge_provider: "stripe", charge_ref: intent.id,
            charged_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          charged++;
          revenuePaise += row.amount_paise;
        } else {
          throw new Error(`status=${intent.status}`);
        }
      } catch (e: any) {
        await supa.from("usage_overages").update({
          status: "failed",
          failure_reason: String(e?.message ?? e).slice(0, 240),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      ok: true, processed: (rows ?? []).length, charged, failed,
      revenue_rupees: Math.round(revenuePaise / 100),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("charge-overages failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
