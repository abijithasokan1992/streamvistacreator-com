// Creates (idempotently) a Razorpay Plan for the Creator tier and opens a
// Razorpay Subscription for the authenticated user. Returns the subscription
// id + short_url + key id for the front-end to open Razorpay Checkout in
// subscription mode.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { loadRazorpayCreds } from "../_shared/razorpay-config.ts";

const PLAN_ID_LOCAL = "creator_monthly_inr"; // local handle; Razorpay returns its own plan_id
const PLAN_AMOUNT_PAISE = 76700; // ₹767/month per TB (inc. GST)
const PLAN_NAME = "StreamVista Creator (per TB / month)";

function jsonError(req: Request, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function rzpFetch(path: string, auth: string, init: RequestInit = {}) {
  return fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...(init.headers || {}),
    },
  });
}

async function ensurePlan(auth: string, supabase: any): Promise<string> {
  // Cache the Razorpay plan id on the razorpay_config table for idempotency.
  const { data: cfg } = await supabase
    .from("razorpay_config")
    .select("creator_plan_id")
    .eq("id", true)
    .maybeSingle()
    .catch(() => ({ data: null }));
  if (cfg?.creator_plan_id) return cfg.creator_plan_id;

  const res = await rzpFetch("/plans", auth, {
    method: "POST",
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: {
        name: PLAN_NAME,
        amount: PLAN_AMOUNT_PAISE,
        currency: "INR",
        description: "Per-TB managed storage with unmetered review bandwidth",
      },
      notes: { local_id: PLAN_ID_LOCAL },
    }),
  });
  const plan = await res.json();
  if (!res.ok) {
    console.error("Razorpay plan create failed", plan);
    throw new Error(plan?.error?.description || "Plan creation failed");
  }
  // Best-effort cache; ignore if column doesn't exist.
  try {
    await supabase.from("razorpay_config").update({ creator_plan_id: plan.id }).eq("id", true);
  } catch (_) {}
  return plan.id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(req) });
  if (req.method !== "POST") return jsonError(req, "Method not allowed", 405);

  try {
    const body = await req.json().catch(() => ({}));
    const tbCount = Math.max(1, Math.min(10, Number(body?.tbCount ?? 1)));

    // Derive authenticated user from JWT.
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supaUrl || !anonKey || !serviceKey) return jsonError(req, "Service unavailable", 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError(req, "Unauthorized", 401);

    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    const userEmail = claims?.claims?.email as string | undefined;
    if (!userId) return jsonError(req, "Unauthorized", 401);

    const supabase = createClient(supaUrl, serviceKey);
    const creds = await loadRazorpayCreds(supabase);
    if (!creds) return jsonError(req, "Payments are not configured", 503);
    const auth = btoa(`${creds.keyId}:${creds.keySecret}`);

    const planId = await ensurePlan(auth, supabase);

    // Total billing cycles: 12 (one year). User can cancel any time via support.
    const subRes = await rzpFetch("/subscriptions", auth, {
      method: "POST",
      body: JSON.stringify({
        plan_id: planId,
        total_count: 12,
        quantity: tbCount,
        customer_notify: 1,
        notes: { userId, plan: "creator", tb: String(tbCount) },
      }),
    });
    const sub = await subRes.json();
    if (!subRes.ok) {
      console.error("Razorpay subscription create failed", sub);
      return jsonError(req, sub?.error?.description || "Subscription creation failed", 502);
    }

    // Record placeholder row so webhook can update it.
    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        customer_email: userEmail ?? null,
        razorpay_subscription_id: sub.id,
        razorpay_plan_id: planId,
        price_id: "cloudx_creator",
        status: sub.status ?? "created",
        environment: creds.mode === "live" ? "live" : "sandbox",
        gateway: "razorpay",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "razorpay_subscription_id" },
    );

    return new Response(
      JSON.stringify({
        subscriptionId: sub.id,
        shortUrl: sub.short_url,
        keyId: creds.keyId,
        planId,
      }),
      { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-razorpay-subscription error", e);
    return jsonError(req, "Subscription creation failed", 500);
  }
});
