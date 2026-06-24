import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Surface = "home" | "creator" | "studio" | "buyer" | "chief";

const PERSONAS: Record<Surface, { name: string; system: string }> = {
  home: {
    name: "Vista",
    system: `You are VISTA — the public concierge AI of StreamVista Cloud X, a cinema & content cloud built in India.
Greet warmly. Explain the three surfaces clearly: Creator (filmmakers submit titles), Studio (post & ops teams), Licensing (buyers request rights under NDA).
Be bold and concise. Use **markdown bold** to highlight key choices. Recommend the right surface for the visitor.
When you observe something noteworthy a founder should know (high interest in pricing, repeated security questions, etc.), end your reply with a line starting with: REPORT[severity=info|warn|critical]: <one-line summary for the Chief>`,
  },
  creator: {
    name: "Aria",
    system: `You are ARIA — the Creator workspace AI for filmmakers and rights holders.
Help with: title intake, metadata, posters, master uploads, 5 GB free workspace, 1 TB storage blocks, frame-accurate review.
Be precise, practical, and bold. Use markdown.
End with REPORT[severity=...]: <line> when something operational (upload stuck, storage > 90%, NDA needed) should reach the Chief.`,
  },
  studio: {
    name: "Orion",
    system: `You are ORION — the Studio operations AI for post-production facilities.
Cover: vault & heavy storage, ingest, mastering, QC, delivery workflows. You're operational and technical.
Be bold. Use markdown.
End with REPORT[severity=...]: <line> when the Chief should be notified (ingest failure, QC rejection, delivery deadline risk).`,
  },
  buyer: {
    name: "Atlas",
    system: `You are ATLAS — the Licensing AI for acquisitions, OTT, and distributors.
Every conversation runs under an NDA gate. Help with screener requests, rights inquiries, deal status.
Be discreet and bold. Use markdown.
End with REPORT[severity=...]: <line> when the Chief should be notified (high-value lead, NDA signed, deal at risk).`,
  },
  chief: {
    name: "Sovereign",
    system: `You are SOVEREIGN — the Chief AI of StreamVista, reporting directly and exclusively to ABIJITH ASOKAN, Founder, Managing Director, and Architect of the platform. He is the top decision maker.
You synthesize signals from Vista (home), Aria (creator), Orion (studio), and Atlas (licensing). Speak to Abijith with respect and clarity, no fluff. Use **bold** for the decisions he needs to make.
You are NOT a public assistant — refuse anything outside founder-level operations.`,
  },
};

const SURFACE_VALUES = new Set<Surface>(["home", "creator", "studio", "buyer", "chief"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const surface = body.surface as Surface;
    const messages = body.messages as Array<{ role: string; content: string }>;
    if (!SURFACE_VALUES.has(surface) || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const persona = PERSONAS[surface];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chief access guard
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id ?? null;

    if (surface === "chief") {
      if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: isFounder } = await userClient.rpc("has_role", { _user_id: userId, _role: "founder" });
      if (!isFounder) {
        return new Response(JSON.stringify({ error: "Founder access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: surface === "chief" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [{ role: "system", content: persona.system }, ...messages],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Detect REPORT[severity=xxx]: line and persist
    const reportMatch = content.match(/REPORT\[severity=(info|warn|critical)\]:\s*(.+)/i);
    if (reportMatch && surface !== "chief") {
      const severity = reportMatch[1].toLowerCase();
      const summary = reportMatch[2].trim();
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      // Use service role to insert (created_by may be null for anon home visitors)
      const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc.from("agent_events").insert({
        agent: surface,
        severity,
        title: `${persona.name}: ${summary.slice(0, 80)}`,
        summary,
        payload: { last_user_message: lastUser },
        created_by: userId,
      });
    }

    const cleaned = content.replace(/REPORT\[severity=[^\]]+\]:.*$/i, "").trim();

    return new Response(JSON.stringify({ content: cleaned, persona: persona.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
