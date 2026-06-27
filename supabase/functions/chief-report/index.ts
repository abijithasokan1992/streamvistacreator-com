import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);
  const corsHeaders = buildCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isFounder } = await userClient.rpc("has_role", { _user_id: userId, _role: "founder" });
    if (!isFounder) return new Response(JSON.stringify({ error: "Founder access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { data: events } = await svc
      .from("agent_events")
      .select("agent,severity,title,summary,created_at")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(80);

    const eventLines = (events ?? []).map((e) => `[${e.severity.toUpperCase()}] (${e.agent}) ${e.title} — ${e.summary ?? ""}`).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are SOVEREIGN, the Chief AI reporting directly to ABIJITH ASOKAN — Founder, Managing Director, and Architect of StreamVista. Compose a concise spoken briefing (180-260 words, conversational, suitable for text-to-speech). Address him as "Abijith". Cover:\n1. What the four surface agents (Vista/Aria/Orion/Atlas) observed in the last 24 hours.\n2. Top 3 risks or opportunities.\n3. One clear recommended action.\nNo markdown, no lists, no special characters — plain spoken prose only.`,
          },
          {
            role: "user",
            content: eventLines.length > 0 ? `Latest agent events:\n${eventLines}` : "No agent events in the last 24 hours. Brief Abijith on the quiet period and recommend one proactive action.",
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      return new Response(JSON.stringify({ error: "AI error", status: aiResp.status }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await aiResp.json();
    const body: string = data.choices?.[0]?.message?.content ?? "";
    const title = `Chief Briefing — ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`;

    const { data: inserted } = await svc
      .from("agent_reports")
      .insert({
        title,
        body,
        event_window_start: windowStart.toISOString(),
        event_window_end: new Date().toISOString(),
        generated_by: userId,
      })
      .select()
      .single();

    return new Response(JSON.stringify({ report: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
