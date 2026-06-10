// Auto-bills pending usage_overages.
//   • Stripe customers → off_session PaymentIntent against their saved card.
//   • Razorpay customers → recurring payment against their stored token
//     (subscriptions.razorpay_customer_id + razorpay_token_id, populated
//      when the user authorised the original mandate).
// Master switch lives in billing_config.auto_charge_enabled.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { createStripeClient } from "../_shared/stripe.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function chargeRazorpay(
  admin: any,
  row: { id: string; user_id: string; amount_paise: number; kind: string; period_start: string },
): Promise<{ ok: boolean; ref?: string; reason?: string }> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("razorpay_customer_id, razorpay_token_id")
    .eq("user_id", row.user_id)
    .eq("gateway", "razorpay")
    .not("razorpay_token_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub?.razorpay_customer_id || !sub?.razorpay_token_id) {
    return { ok: false, reason: "no_razorpay_token" };
  }
  const creds = await loadRazorpayCreds(admin);
  if (!creds) return { ok: false, reason: "razorpay_not_configured" };
  const auth = btoa(`${creds.keyId}:${creds.keySecret}`);

  // 1. Order with recurring intent
  const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: row.amount_paise, currency: "INR", payment_capture: 1,
      notes: { overage_id: row.id, kind: row.kind, period: row.period_start },
    }),
  });
  if (!orderRes.ok) {
    const t = await orderRes.text().catch(() => "");
    return { ok: false, reason: `order_${orderRes.status}_${t.slice(0, 120)}` };
  }
  const order = await orderRes.json();

  // 2. Recurring charge against saved token
  const payRes = await fetch("https://api.razorpay.com/v1/payments/create/recurring", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      email: undefined, contact: undefined,
      amount: row.amount_paise, currency: "INR",
      order_id: order.id, customer_id: sub.razorpay_customer_id, token: sub.razorpay_token_id,
      recurring: "1", description: `StreamVista overage ${row.kind}`,
    }),
  });
  if (!payRes.ok) {
    const t = await payRes.text().catch(() => "");
    return { ok: false, reason: `pay_${payRes.status}_${t.slice(0, 160)}` };
  }
  const pay = await payRes.json();
  if (pay.status !== "captured" && pay.status !== "authorized") {
    return { ok: false, reason: `status_${pay.status}` };
  }
  return { ok: true, ref: pay.id };
}

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
      // Prefer Stripe if a saved card exists; otherwise try Razorpay token.
      const { data: sub } = await supa
        .from("subscriptions")
        .select("stripe_customer_id, environment, gateway, razorpay_customer_id, razorpay_token_id")
        .eq("user_id", row.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let success = false;
      let lastErr = "no_saved_payment_method";

      if (sub?.stripe_customer_id) {
        try {
          const stripe = createStripeClient((sub.environment as "sandbox" | "live") ?? "sandbox");
          const pms = await stripe.paymentMethods.list({ customer: sub.stripe_customer_id, type: "card", limit: 1 });
          const pmId = pms.data[0]?.id;
          if (!pmId) throw new Error("no_card_on_file");
          const intent = await stripe.paymentIntents.create({
            amount: row.amount_paise, currency: "inr",
            customer: sub.stripe_customer_id, payment_method: pmId,
            off_session: true, confirm: true,
            description: `StreamVista overage · ${row.kind} · ${row.period_start}`,
            metadata: { overage_id: row.id, user_id: row.user_id, kind: row.kind },
          });
          if (intent.status !== "succeeded") throw new Error(`status=${intent.status}`);
          await supa.from("usage_overages").update({
            status: "charged", charge_provider: "stripe", charge_ref: intent.id,
            charged_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          success = true;
        } catch (e: any) {
          lastErr = `stripe: ${String(e?.message ?? e).slice(0, 200)}`;
        }
      }

      if (!success && sub?.razorpay_token_id) {
        const rz = await chargeRazorpay(supa, row as any);
        if (rz.ok) {
          await supa.from("usage_overages").update({
            status: "charged", charge_provider: "razorpay", charge_ref: rz.ref,
            charged_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          success = true;
        } else {
          lastErr = `razorpay: ${rz.reason}`;
        }
      }

      if (success) {
        charged++;
        revenuePaise += row.amount_paise;
      } else {
        await supa.from("usage_overages").update({
          status: "failed", failure_reason: lastErr.slice(0, 240),
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
