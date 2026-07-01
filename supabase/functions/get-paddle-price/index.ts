import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function resolvePaddlePrice(priceId: string, environment: PaddleEnv): Promise<string> {
  const response = await gatewayFetch(
    environment,
    `/prices?external_id=${encodeURIComponent(priceId)}`,
  );
  const data = await response.json();
  if (!data.data?.length) throw new Error("Price not found");
  return data.data[0].id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    // Require an authenticated caller — this endpoint hits Paddle with the
    // platform's server-side API keys, so anonymous access is not allowed.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user?.id) return json({ error: "Unauthorized" }, 401);

    const { priceId, environment } = await req.json();
    if (!priceId) return json({ error: "priceId required" }, 400);

    const env: PaddleEnv = environment === "live" ? "live" : "sandbox";
    const paddleId = await resolvePaddlePrice(priceId, env);
    return json({ paddleId }, 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
