/**
 * create-vault-purchase
 *
 * Creates a Studio Vault top-up row (via studio_vault_create_topup RPC)
 * and a matching Razorpay order. Returns the order details so the
 * Studio dashboard can open Razorpay Checkout. Verification reuses
 * the existing verify-storage-topup function (entitlement projection
 * automatically branches on `source = 'studio_vault'`).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonWith(req: Request) {
  const cors = buildCorsHeaders(req);
  return (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const json = jsonWith(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId ?? "");
    const tb = Math.max(1, Math.min(500, Number(body?.tb ?? 1) || 1));
    const months = [1, 3, 6, 12].includes(Number(body?.months)) ? Number(body.months) : 1;
    if (!productId) return json({ error: "Missing productId" }, 400);

    // Price preview (also validates product / range)
    const { data: priced, error: priceErr } = await userClient.rpc("studio_vault_calculate_price", {
      _product_id: productId, _tb: tb, _months: months,
    });
    if (priceErr || !priced) return json({ error: priceErr?.message || "Price calculation failed" }, 400);

    // Create pending vault topup row (server-side, authoritative)
    const { data: topupId, error: createErr } = await userClient.rpc("studio_vault_create_topup", {
      _product_id: productId, _tb: tb, _months: months,
    });
    if (createErr || !topupId) return json({ error: createErr?.message || "Could not create purchase" }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) {
      await admin.from("storage_topups").update({ status: "failed", notes: "razorpay_not_configured" }).eq("id", topupId);
      return json({ error: "Razorpay not configured" }, 503);
    }

    const amountPaise = Number((priced as Record<string, unknown>).total_paise) || 0;
    if (amountPaise <= 0) return json({ error: "Invalid amount" }, 400);

    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `vault_${String(topupId).slice(0, 28)}`,
        notes: {
          topup_id: String(topupId),
          user_id: uid,
          product_id: productId,
          tb: String(tb),
          months: String(months),
          source: "studio_vault",
        },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay vault order error", order);
      await admin.from("storage_topups").update({ status: "failed", notes: "order_create_failed" }).eq("id", topupId);
      return json({ error: "Order creation failed" }, 502);
    }

    await admin.from("storage_topups").update({ razorpay_order_id: order.id }).eq("id", topupId);

    return json({
      topupId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: creds.keyId,
      priced,
    });
  } catch (e) {
    console.error("create-vault-purchase error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
