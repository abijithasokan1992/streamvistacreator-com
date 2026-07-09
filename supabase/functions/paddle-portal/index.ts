// GET /paddle-portal — issues a signed redirect to the Paddle-hosted customer
// portal for the authenticated user. The Paddle customer id is resolved
// entirely from the backend session — never from client-supplied input.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { getPaddleClient, type PaddleEnv } from "../_shared/paddle.ts";
import { checkUserPaidAccess } from "../_shared/paddleAccess.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // 1) Authenticate the caller server-side.
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: who, error: whoErr } = await asUser.auth.getUser();
    if (whoErr || !who?.user?.id) return json({ error: "Unauthorized" }, 401);
    const userId = who.user.id;

    const url = new URL(req.url);
    const env: PaddleEnv = url.searchParams.get("env") === "live" ? "live" : "sandbox";
    const mode = url.searchParams.get("mode"); // "redirect" (default) or "json"

    // 2) Look up the customer + pick the CURRENT active subscription from the mirror.
    //    A user may have multiple mirrored subscriptions (historical cancels, upgrades,
    //    multiple products). We must pick the one that actually reflects live access,
    //    not simply the most-recently-updated row (which could be a canceled record
    //    that Paddle just touched).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: subs } = await admin
      .from("subscriptions")
      .select(
        "paddle_customer_id,paddle_subscription_id,status,environment,current_period_end,updated_at,created_at",
      )
      .eq("user_id", userId)
      .eq("environment", env)
      .not("paddle_customer_id", "is", null)
      .order("updated_at", { ascending: false });

    const rows = (subs ?? []) as Array<{
      paddle_customer_id: string | null;
      paddle_subscription_id: string | null;
      status: string | null;
      current_period_end: string | null;
      updated_at: string | null;
      created_at: string | null;
    }>;

    if (rows.length === 0) return json({ error: "No Paddle customer on file" }, 404);

    // Priority: active > trialing > past_due > paused > canceled > anything else.
    // Within the same status, prefer the row with the latest current_period_end,
    // then latest updated_at. This ensures we surface the live subscription even
    // when a stale canceled row was touched more recently.
    const STATUS_RANK: Record<string, number> = {
      active: 0,
      trialing: 1,
      past_due: 2,
      paused: 3,
      canceled: 4,
    };
    const rank = (s: string | null) =>
      s && s in STATUS_RANK ? STATUS_RANK[s] : 99;
    const ts = (v: string | null) => (v ? Date.parse(v) || 0 : 0);

    const sorted = [...rows].sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      const pe = ts(b.current_period_end) - ts(a.current_period_end);
      if (pe !== 0) return pe;
      return ts(b.updated_at) - ts(a.updated_at);
    });

    // Prefer a row that shares the customer_id of the top-ranked subscription.
    const best = sorted[0];
    const customerId = best.paddle_customer_id as string | undefined;
    if (!customerId) return json({ error: "No Paddle customer on file" }, 404);

    // Collect the current active/trialing subscription id(s) for this customer so
    // the portal deep-links to the right subscription. Fall back to the top-ranked
    // row if none are strictly active.
    const activeForCustomer = sorted.filter(
      (r) =>
        r.paddle_customer_id === customerId &&
        (r.status === "active" || r.status === "trialing") &&
        !!r.paddle_subscription_id,
    );
    const chosenSubId =
      activeForCustomer[0]?.paddle_subscription_id ??
      best.paddle_subscription_id ??
      null;

    // Cross-check with the shared access helper (respects grace periods).
    const access = await checkUserPaidAccess(customerId, admin);
    const subscriptionIds = chosenSubId
      ? [chosenSubId]
      : access.subscriptionId
        ? [access.subscriptionId]
        : [];

    // 3) Ask Paddle for an ephemeral portal session.
    const paddle = getPaddleClient(env);
    const session = await (paddle as any).customerPortalSessions.create(
      customerId,
      subscriptionIds,
    );

    const overviewUrl: string | undefined =
      session?.urls?.general?.overview ?? session?.overview_url;
    if (!overviewUrl) return json({ error: "Paddle did not return a portal URL" }, 502);

    if (mode === "json") return json({ url: overviewUrl, access }, 200);
    return new Response(null, {
      status: 302,
      headers: { ...cors, Location: overviewUrl },
    });
  } catch (e) {
    console.error("paddle-portal error", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
