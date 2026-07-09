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

    // 2) Look up the customer + latest active subscription from the mirror.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: sub } = await admin
      .from("subscriptions")
      .select("paddle_customer_id,paddle_subscription_id,status,environment")
      .eq("user_id", userId)
      .eq("environment", env)
      .not("paddle_customer_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = (sub as any)?.paddle_customer_id as string | undefined;
    if (!customerId) return json({ error: "No Paddle customer on file" }, 404);

    const access = await checkUserPaidAccess(customerId, admin);
    const subscriptionIds = access.subscriptionId ? [access.subscriptionId] : [];

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
