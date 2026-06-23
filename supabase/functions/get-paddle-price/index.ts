import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { priceId, environment } = await req.json();
    if (!priceId) {
      return new Response(JSON.stringify({ error: "priceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env: PaddleEnv = environment === "live" ? "live" : "sandbox";
    const paddleId = await resolvePaddlePrice(priceId, env);
    return new Response(JSON.stringify({ paddleId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
