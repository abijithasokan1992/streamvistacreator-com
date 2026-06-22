/**
 * cancel-creator-storage
 *
 * Marks a Creator storage subscription for cancellation at the end of the
 * current billing cycle. The user retains paid storage entitlement until
 * `current_period_end`; after that the webhook will flip status to
 * cancelled/completed and entitlement will drop back to included + admin grants.
 *
 * Server-validated: only the owner of the subscription can cancel it.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (userErr || !uid) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const subscriptionId = String(body?.subscriptionId ?? "").trim();
    if (!subscriptionId) return json({ error: "subscriptionId required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Server-side ownership + type check — never trust the client.
    const { data: row, error: rowErr } = await admin
      .from("subscriptions")
      .select("id, user_id, razorpay_subscription_id, subscription_type, status, cancel_at_period_end")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();
    if (rowErr || !row) return json({ error: "Subscription not found" }, 404);
    if (row.user_id !== uid) return json({ error: "Forbidden" }, 403);
    if (row.subscription_type !== "creator_storage") {
      return json({ error: "Only Creator storage subscriptions can be cancelled here." }, 400);
    }

    const creds = await loadRazorpayCreds(admin);
    if (!creds) return json({ error: "Razorpay not configured" }, 503);

    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
        body: JSON.stringify({ cancel_at_cycle_end: 1 }),
      },
    );
    const sub = await rzpRes.json();
    if (!rzpRes.ok) {
      console.error("Razorpay cancel failed", sub);
      return json({ error: sub?.error?.description || "Cancellation failed" }, 502);
    }

    await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancel_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return json({ ok: true, subscriptionId, scheduledCancel: true, status: sub.status });
  } catch (e) {
    console.error("cancel-creator-storage error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
