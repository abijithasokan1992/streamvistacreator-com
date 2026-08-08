import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const ALLOWED_AGENT_IDS = new Set([
  "vista-concierge-agent",
  "creator-success-agent",
  "studio-operations-agent",
  "buyer-success-agent",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const corsHeaders = buildCorsHeaders(req);
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: { code: "method_not_allowed", message: "POST required." } }), { status: 405, headers });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !anonKey || !authHeader) {
      return new Response(JSON.stringify({ error: { code: "authentication_required", message: "Authenticated Creator session required." } }), { status: 401, headers });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user) {
      return new Response(JSON.stringify({ error: { code: "authentication_required", message: "Authenticated Creator session required." } }), { status: 401, headers });
    }

    const body = await req.json().catch(() => null) as {
      agentId?: unknown;
      input?: unknown;
      context?: unknown;
    } | null;
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";
    if (!ALLOWED_AGENT_IDS.has(agentId)) {
      return new Response(JSON.stringify({ error: { code: "agent_not_allowed", message: "This Creator surface is not registered with ENTE." } }), { status: 400, headers });
    }

    const runtimeUrl = (Deno.env.get("ENTE_AGENT_RUNTIME_URL") ?? "").replace(/\/$/, "");
    const runtimeToken = Deno.env.get("ENTE_RUNTIME_SHARED_TOKEN") ?? "";
    if (!runtimeUrl || !runtimeToken) {
      return new Response(JSON.stringify({ error: { code: "ente_runtime_not_configured", message: "ENTE runtime connection is not configured." } }), { status: 503, headers });
    }

    const runtimeResponse = await fetch(`${runtimeUrl}/api/agents/${encodeURIComponent(agentId)}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtimeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: typeof body?.input === "object" && body.input !== null ? body.input : {},
        context: {
          ...(typeof body?.context === "object" && body.context !== null ? body.context as Record<string, unknown> : {}),
          source: "streamvistacreator-com",
          authenticatedUserId: user.id,
        },
      }),
    });

    const runtimeBody = await runtimeResponse.json().catch(() => null);
    if (!runtimeResponse.ok) {
      const fallback = { error: { code: "ente_runtime_request_failed", message: `ENTE runtime returned HTTP ${runtimeResponse.status}.` } };
      return new Response(JSON.stringify(runtimeBody ?? fallback), { status: runtimeResponse.status, headers });
    }

    return new Response(JSON.stringify(runtimeBody), { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: { code: "ente_proxy_failed", message: error instanceof Error ? error.message : String(error) } }), { status: 500, headers });
  }
});
