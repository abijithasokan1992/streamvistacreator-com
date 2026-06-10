/**
 * verify-storage-topup
 *
 * Verifies the Razorpay signature for a PAYG top-up, marks the
 * `storage_topups` row as paid, and increments the user's `topup_tb`
 * counter on `user_profiles`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac } from "node:crypto";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const uid = claims?.claims?.sub;
    if (!uid) return json({ error: "Unauthorized" }, 401);

    const { topupId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!topupId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing fields" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    const expected = createHmac("sha256", creds.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) return json({ error: "Signature mismatch" }, 400);

    // Load + ownership check
    const { data: row, error: rowErr } = await admin
      .from("storage_topups").select("*").eq("id", topupId).maybeSingle();
    if (rowErr || !row) return json({ error: "Top-up not found" }, 404);
    if (row.user_id !== uid) return json({ error: "Forbidden" }, 403);
    if (row.razorpay_order_id !== razorpay_order_id) return json({ error: "Order mismatch" }, 400);

    // Idempotency: skip if already paid
    if (row.status === "paid") return json({ ok: true, already: true });

    // Mark paid + bump topup_tb
    await admin.from("storage_topups")
      .update({ status: "paid", razorpay_payment_id })
      .eq("id", topupId);

    const { data: prof } = await admin
      .from("user_profiles").select("topup_tb,plan_tier").eq("user_id", uid).maybeSingle();
    const next = Number(prof?.topup_tb || 0) + Number(row.tb_added || 1);
    await admin.from("user_profiles")
      .update({ topup_tb: next, plan_tier: prof?.plan_tier === "free" ? "creator" : (prof?.plan_tier || "creator") })
      .eq("user_id", uid);

    return json({ ok: true, topup_tb: next });
  } catch (e) {
    console.error("verify-storage-topup error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
