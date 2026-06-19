/**
 * fastlink-pay
 *
 * Two actions for the recovery-page "Fast Link to Dashboard" flow:
 *
 *  - action: "create"  → creates a ₹1 Razorpay order tied to the signed-in
 *                        user, inserts a row in `fastlink_payments`, returns
 *                        order details for client-side Razorpay Checkout.
 *  - action: "verify"  → verifies the Razorpay signature, marks the row as
 *                        paid, and returns `{ verified: true }`.
 *
 * The caller MUST already be authenticated. During the recovery flow Supabase
 * creates a temporary session from the recovery token, so `auth.uid()` is
 * valid even though the user hasn't set a new password.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const FASTLINK_AMOUNT_PAISE = 100; // ₹1.00

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? buildCorsHeaders(req) : {}), "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const j = (b: unknown, s = 200) => json(b, s, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);
    const uid = userRes.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    if (action === "create") {
      // Ledger row first so we can attach order_id afterwards.
      const { data: row, error: insErr } = await admin
        .from("fastlink_payments")
        .insert({
          user_id: uid,
          amount_inr: FASTLINK_AMOUNT_PAISE / 100,
          status: "pending",
          context: "recovery_fastlink",
        })
        .select("id")
        .single();
      if (insErr || !row) return json({ error: insErr?.message || "Insert failed" }, 500);

      // Razorpay creds occasionally arrive with stray whitespace / unicode
      // characters from secret entry. Sanitize to ASCII before base64-encoding.
      const safeKeyId = creds.keyId.trim().replace(/[^\x20-\x7E]/g, "");
      const safeKeySecret = creds.keySecret.trim().replace(/[^\x20-\x7E]/g, "");
      const auth = btoa(`${safeKeyId}:${safeKeySecret}`);
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          amount: FASTLINK_AMOUNT_PAISE,
          currency: "INR",
          receipt: `fl_${row.id.slice(0, 28)}`,
          notes: { fastlink_id: row.id, user_id: uid },
        }),
      });
      const order = await rzpRes.json();
      if (!rzpRes.ok) {
        console.error("Razorpay order error", order);
        await admin
          .from("fastlink_payments")
          .update({ status: "failed" })
          .eq("id", row.id);
        return json({ error: "Order creation failed" }, 502);
      }

      await admin
        .from("fastlink_payments")
        .update({ razorpay_order_id: order.id })
        .eq("id", row.id);

      return json({
        fastlinkId: row.id,
        orderId: order.id,
        amount: FASTLINK_AMOUNT_PAISE,
        currency: "INR",
        keyId: creds.keyId,
      });
    }

    if (action === "verify") {
      const orderId = String(body?.razorpay_order_id ?? "");
      const paymentId = String(body?.razorpay_payment_id ?? "");
      const signature = String(body?.razorpay_signature ?? "");
      if (!orderId || !paymentId || !signature) {
        return json({ error: "Missing payment fields" }, 400);
      }

      const expected = await hmacSha256Hex(creds.keySecret, `${orderId}|${paymentId}`);
      if (expected !== signature) {
        await admin
          .from("fastlink_payments")
          .update({ status: "failed" })
          .eq("razorpay_order_id", orderId)
          .eq("user_id", uid);
        return json({ verified: false, error: "Signature mismatch" }, 400);
      }

      const { data: updated, error: upErr } = await admin
        .from("fastlink_payments")
        .update({
          status: "paid",
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        })
        .eq("razorpay_order_id", orderId)
        .eq("user_id", uid)
        .select("id")
        .single();
      if (upErr || !updated) {
        return json({ verified: false, error: "Ledger update failed" }, 500);
      }

      return json({ verified: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("fastlink-pay error:", e instanceof Error ? e.message : String(e));
    return json({ error: "Internal server error" }, 500);
  }
});
