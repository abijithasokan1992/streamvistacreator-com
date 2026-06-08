import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";
import { PROMO_CODES } from "../_shared/pricing.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { code } = await req.json();
    const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
    const discount = normalized && PROMO_CODES[normalized] ? PROMO_CODES[normalized] : 0;
    return new Response(
      JSON.stringify({ valid: discount > 0, code: discount > 0 ? normalized : null, discount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("validate-promo error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
