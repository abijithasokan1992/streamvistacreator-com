/**
 * create-storage-topup
 *
 * Creates a Razorpay order for a 1 TB Pay-As-You-Go top-up and records a
 * row in `storage_topups`. Returns the order details for client-side
 * Razorpay Checkout.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { computeFinalPricePaise } from "../_shared/pricing.ts";
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
    // Two modes:
    //  • `tb` — legacy 1 TB Production Vault block (integer 1-10). Uses shared
    //    pricing + canonical cross-check.
    //  • `gb` — smaller top-up tiers (100 or 500 GB). Price scales linearly
    //    from the canonical per-TB price; canonical cross-check is skipped
    //    because it is defined per full TB.
    const rawGb = Number(body?.gb);
    const allowedGb = new Set([100, 500]);
    const useGb = Number.isFinite(rawGb) && allowedGb.has(rawGb);
    const tb = useGb ? rawGb / 1024 : Math.max(1, Math.min(10, Number(body?.tb ?? 1) || 1));

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    let amountPaise: number;
    if (useGb) {
      // Per-TB canonical price is 767 INR incl. GST → 76,700 paise. Scale linearly.
      const perTbPaise = computeFinalPricePaise("topup", null, 1).finalPaise;
      amountPaise = Math.round(perTbPaise * (rawGb / 1024));
    } else {
      const priced = computeFinalPricePaise("topup", null, tb);
      const { data: canonical } = await admin.rpc("get_canonical_payg_price");
      if (canonical && (canonical as any).total_paise) {
        const expectedPerTb = Number((canonical as any).total_paise);
        const perTb = Math.round(priced.finalPaise / tb);
        if (Math.abs(perTb - expectedPerTb) > 1) {
          console.error("price drift detected", { expectedPerTb, perTb });
          return json({ error: "Pricing temporarily unavailable, please retry." }, 503);
        }
      }
      amountPaise = priced.finalPaise; // 76,700 paise per TB (incl. GST)
    }

    // Insert ledger row (service role)
    const { data: row, error: insErr } = await admin
      .from("storage_topups")
      .insert({
        user_id: uid,
        tb_added: tb,
        amount_inr: amountPaise / 100,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr || !row) return json({ error: insErr?.message || "Could not create top-up" }, 500);

    // Create Razorpay order
    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `topup_${row.id.slice(0, 28)}`,
        payment_capture: 1,
        notes: {
          topup_id: row.id,
          user_id: uid,
          tb: String(tb),
          gb: useGb ? String(rawGb) : "",
          // Forward client-supplied metadata (workspace_id, payment_purpose,
          // etc.) so the webhook has full context without trusting the
          // client session again. Values are coerced to strings — Razorpay
          // `notes` is a flat string→string map.
          ...(body?.__metadata && typeof body.__metadata === "object"
            ? Object.fromEntries(
                Object.entries(body.__metadata as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                  .slice(0, 15)
                  .map(([k, v]) => [`meta_${k}`.slice(0, 40), String(v).slice(0, 240)]),
              )
            : {}),
        },
      }),
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay order error", order);
      await admin.from("storage_topups").update({ status: "failed", notes: "order_create_failed" }).eq("id", row.id);
      const rzpMessage = order?.error?.description || order?.error?.reason || order?.error?.message;
      return json({ error: rzpMessage ? `Razorpay order creation failed: ${rzpMessage}` : "Razorpay order creation failed. Please try again, or contact support if your bank shows a debit." }, 502);
    }

    await admin.from("storage_topups").update({ razorpay_order_id: order.id }).eq("id", row.id);

    return json({ topupId: row.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId: creds.keyId });
  } catch (e) {
    console.error("create-storage-topup error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
