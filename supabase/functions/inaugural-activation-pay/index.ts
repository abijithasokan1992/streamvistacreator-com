/**
 * inaugural-activation-pay
 *
 * Special one-time ₹750 + 18% GST (= ₹885 / 88500 paise) inaugural
 * founder activation payment. Restricted to a single hardcoded user
 * (CA Aruna Sankar). Layered on top of the existing Razorpay flow —
 * does NOT replace storage / billing / plan logic.
 *
 *  - action: "create" → creates a Razorpay order tied to the caller,
 *                       inserts an audit row in `razorpay_audit_log`
 *                       with event_type 'inaugural_founder_activation',
 *                       returns checkout details.
 *  - action: "verify" → verifies the Razorpay signature, marks the
 *                       audit row as paid, writes a custom in-app
 *                       notification and triggers the inaugural
 *                       confirmation email.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// Aruna Sankar — sole eligible user for inaugural founder activation.
const ARUNA_USER_ID = "6d6680c4-156c-4d57-833d-951f56101879";

// ₹750 + 18% GST = ₹885 → 88500 paise.
const AMOUNT_PAISE = 88500;

const EVENT_TYPE = "inaugural_founder_activation";

function json(body: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? buildCorsHeaders(req) : {}), "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const j = (b: unknown, s = 200) => json(b, s, req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userRes?.user) return j({ error: "Unauthorized" }, 401);
    const uid = userRes.user.id;

    // Hard gate — inaugural flow only ever runs for Aruna's account.
    if (uid !== ARUNA_USER_ID) return j({ error: "Not eligible for inaugural activation" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return j({ error: "Razorpay not configured" }, 503);

    if (action === "create") {
      const safeKeyId = creds.keyId.trim().replace(/[^\x20-\x7E]/g, "");
      const safeKeySecret = creds.keySecret.trim().replace(/[^\x20-\x7E]/g, "");
      const auth = btoa(`${safeKeyId}:${safeKeySecret}`);

      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({
          amount: AMOUNT_PAISE,
          currency: "INR",
          receipt: `inaug_${uid.slice(0, 24)}`,
          notes: {
            inaugural_founder_payment: "true",
            context: "inaugural_founder_activation",
            user_id: uid,
          },
        }),
      });
      const order = await rzpRes.json();
      if (!rzpRes.ok) {
        console.error("Razorpay order error", order);
        return j({ error: "Order creation failed" }, 502);
      }

      await (admin as any).from("razorpay_audit_log").insert({
        user_id: uid,
        event_type: EVENT_TYPE,
        status: "created",
        amount_paise: AMOUNT_PAISE,
        order_id: order.id, source: "inaugural-activation-pay",
      });

      return j({
        orderId: order.id,
        amount: AMOUNT_PAISE,
        currency: "INR",
        keyId: creds.keyId,
      });
    }

    if (action === "verify") {
      const orderId = String(body?.razorpay_order_id ?? "");
      const paymentId = String(body?.razorpay_payment_id ?? "");
      const signature = String(body?.razorpay_signature ?? "");
      if (!orderId || !paymentId || !signature) {
        return j({ error: "Missing payment fields" }, 400);
      }

      const expected = await hmacSha256Hex(creds.keySecret, `${orderId}|${paymentId}`);
      if (expected !== signature) {
        await (admin as any).from("razorpay_audit_log").insert({
          user_id: uid, event_type: EVENT_TYPE, status: "signature_mismatch",
          amount_paise: AMOUNT_PAISE, order_id: orderId, payment_id: paymentId, source: "inaugural-activation-pay", signature_valid: false,
        });
        return j({ verified: false, error: "Signature mismatch" }, 400);
      }

      await (admin as any).from("razorpay_audit_log").insert({
        user_id: uid, event_type: EVENT_TYPE, status: "paid",
        amount_paise: AMOUNT_PAISE, order_id: orderId, payment_id: paymentId, source: "inaugural-activation-pay", signature_valid: true,
      });

      // Custom in-app notification — replaces the generic billing toast.
      try {
        await (admin as any).from("notifications").insert({
          user_id: uid,
          title: "Welcome to StreamVista — your first activation is complete",
          message:
            "Your inaugural StreamVista activation payment has been received successfully. " +
            "This marks the first official activation milestone in the StreamVista journey, " +
            "and we’re grateful to have you at the very beginning of it.",
        });
      } catch (e) {
        console.error("notification insert failed", e);
      }

      // Custom confirmation email — invoked but does not block the response.
      try {
        const recipient = userRes.user.email ?? "";
        if (recipient) {
          await admin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "inaugural-activation",
              recipientEmail: recipient,
              idempotencyKey: `inaugural-activation-${paymentId}`,
              templateData: {
                displayName: userRes.user.user_metadata?.full_name?.split(" ")?.[0] ?? "Aruna",
              },
            },
          });
        }
      } catch (e) {
        console.error("inaugural email invoke failed", e);
      }

      return j({ verified: true });
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("inaugural-activation-pay error:", e instanceof Error ? e.message : String(e));
    return j({ error: "Internal server error" }, 500);
  }
});
