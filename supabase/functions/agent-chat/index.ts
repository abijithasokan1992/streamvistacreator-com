import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

type Surface = "home" | "creator" | "studio" | "buyer" | "chief";

const PERSONAS: Record<Surface, { name: string; system: string }> = {
  home: {
    name: "Vista",
    system: `You are VISTA — the public concierge AI of StreamVista Cloud X, a cinema & content cloud built in India.
Greet warmly. Explain the three surfaces clearly: Creator (filmmakers submit titles), Studio (post & ops teams), Licensing (buyers request rights under NDA).
Be bold and concise. Use **markdown bold** to highlight key choices. Recommend the right surface for the visitor.
When you observe something noteworthy a founder should know (high interest in pricing, repeated security questions, etc.), end your reply with a line starting with: REPORT[severity=info|warn|critical]: <one-line summary for the Chief>

You are an informational assistant. You do NOT take actions on the user's behalf: you never modify payments, rights, assets, deliveries, subscriptions, roles, or any user/system data. If asked, explain that these actions require the appropriate authenticated workflow inside the platform.`,
  },
  creator: {
    name: "Aria",
    system: `You are ARIA — the Creator workspace AI for filmmakers and rights holders.
Help with: title intake, metadata, posters, master uploads, 5 GB free workspace, 1 TB storage blocks, frame-accurate review.
Be precise, practical, and bold. Use markdown.
End with REPORT[severity=...]: <line> when something operational (upload stuck, storage > 90%, NDA needed) should reach the Chief.

You are an informational assistant. You do NOT take actions on the user's behalf: you never modify payments, rights, assets, deliveries, subscriptions, roles, or any user/system data. Direct users to the corresponding workflow instead.`,
  },
  studio: {
    name: "Orion",
    system: `You are ORION — the Studio operations AI for post-production facilities.
Cover: vault & heavy storage, ingest, mastering, QC, delivery workflows. You're operational and technical.
Be bold. Use markdown.
End with REPORT[severity=...]: <line> when the Chief should be notified (ingest failure, QC rejection, delivery deadline risk).

You are an informational assistant. You do NOT take actions on the user's behalf: you never modify payments, rights, assets, deliveries, subscriptions, roles, or any user/system data. Direct operators to the corresponding workflow instead.`,
  },
  buyer: {
    name: "Atlas",
    system: `You are ATLAS — the Licensing AI for acquisitions, OTT, and distributors.
Every conversation runs under an NDA gate. Help with screener requests, rights inquiries, deal status.
Be discreet and bold. Use markdown.
End with REPORT[severity=...]: <line> when the Chief should be notified (high-value lead, NDA signed, deal at risk).

You are an informational assistant. You do NOT take actions on the user's behalf: you never modify payments, rights, assets, deliveries, subscriptions, roles, or any user/system data. Direct buyers to the corresponding workflow instead.`,
  },
  chief: {
    name: "Sovereign",
    system: `You are SOVEREIGN — the Chief AI of StreamVista, reporting directly and exclusively to ABIJITH ASOKAN, Founder, Managing Director, and Architect of the platform. He is the top decision maker.
You synthesize signals from Vista (home), Aria (creator), Orion (studio), and Atlas (licensing). Speak to Abijith with respect and clarity, no fluff. Use **bold** for the decisions he needs to make.
You are NOT a public assistant — refuse anything outside founder-level operations.

You are an advisory assistant. You do NOT autonomously modify payments, rights, assets, deliveries, subscriptions, or user roles. Recommend actions; a human executes them.`,
  },
};

const SURFACE_VALUES = new Set<Surface>(["home", "creator", "studio", "buyer", "chief"]);
const CHIEF_ROLES = ["founder", "platform_owner", "super_admin"] as const;

const MAX_MESSAGES = 20;
const MAX_TOTAL_CHARS = 10_000;
const MAX_SINGLE_CHARS = 4_000;

type ErrorCode =
  | "provider_not_configured"
  | "expired_authentication"
  | "insufficient_role"
  | "exhausted_credits"
  | "rate_limited"
  | "provider_timeout"
  | "provider_failure"
  | "invalid_request";

function makeError(code: ErrorCode, message: string, status: number, cors: HeadersInit, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: { code, message, ...(extra ?? {}) } }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

type ProviderChoice =
  | { kind: "independent"; apiKey: string; baseUrl: string; model: string }
  | { kind: "lovable"; apiKey: string; model: string };

function pickProvider(surface: Surface): ProviderChoice | null {
  const indKey = Deno.env.get("AI_API_KEY");
  const indBase = Deno.env.get("AI_BASE_URL");
  const indModel = surface === "chief"
    ? (Deno.env.get("AI_CHIEF_MODEL") || Deno.env.get("AI_MODEL"))
    : Deno.env.get("AI_MODEL");

  if (indKey && indBase && indModel) {
    return {
      kind: "independent",
      apiKey: indKey,
      baseUrl: indBase.replace(/\/$/, ""),
      model: indModel,
    };
  }

  const lovKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovKey) {
    return {
      kind: "lovable",
      apiKey: lovKey,
      model: surface === "chief" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
    };
  }
  return null;
}

async function callProvider(
  provider: ProviderChoice,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
): Promise<{ ok: true; content: string } | { ok: false; status: number; code: ErrorCode; message: string }> {
  const url = provider.kind === "independent"
    ? `${provider.baseUrl}/chat/completions`
    : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
      signal: controller.signal,
    });

    if (resp.status === 429) {
      return { ok: false, status: 429, code: "rate_limited", message: "The AI provider is rate-limiting requests. Please try again shortly." };
    }
    if (resp.status === 402) {
      return { ok: false, status: 402, code: "exhausted_credits", message: "AI credits are exhausted. Please top up or configure an independent AI provider." };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, status: 502, code: "provider_failure", message: "The AI provider rejected our credentials." };
    }
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      return { ok: false, status: 502, code: "provider_failure", message: `AI provider error (${resp.status}). ${detail.slice(0, 200)}` };
    }
    const data = await resp.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      return { ok: false, status: 504, code: "provider_timeout", message: "The AI provider took too long to respond." };
    }
    return { ok: false, status: 502, code: "provider_failure", message: `AI provider request failed: ${e?.message ?? String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    const body = await req.json();
    const surface = body.surface as Surface;
    const messages = body.messages as Array<{ role: string; content: string }>;
    if (!SURFACE_VALUES.has(surface) || !Array.isArray(messages)) {
      return makeError("invalid_request", "Invalid body", 400, cors);
    }
    if (messages.length === 0 || messages.length > MAX_MESSAGES) {
      return makeError("invalid_request", `messages must contain 1..${MAX_MESSAGES} items`, 400, cors);
    }
    let totalChars = 0;
    for (const m of messages) {
      if (!m || typeof m.role !== "string" || typeof m.content !== "string") {
        return makeError("invalid_request", "Invalid message shape", 400, cors);
      }
      if (m.content.length > MAX_SINGLE_CHARS) {
        return makeError("invalid_request", `Single message exceeds ${MAX_SINGLE_CHARS} chars`, 400, cors);
      }
      totalChars += m.content.length;
    }
    if (totalChars > MAX_TOTAL_CHARS) {
      return makeError("invalid_request", `Total messages exceed ${MAX_TOTAL_CHARS} chars`, 400, cors);
    }

    // Auth (required for all surfaces).
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return makeError("expired_authentication", "Please sign in to continue.", 401, cors);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (userErr || !userId) {
      return makeError("expired_authentication", "Your session has expired. Please sign in again.", 401, cors);
    }

    if (surface === "chief") {
      let allowed = false;
      for (const role of CHIEF_ROLES) {
        try {
          const { data: has, error: rpcErr } = await userClient.rpc("has_role", { _user_id: userId, _role: role });
          if (!rpcErr && has === true) { allowed = true; break; }
        } catch { /* unknown role in enum — skip */ }
      }
      if (!allowed) {
        return makeError("insufficient_role", "Chief agent is restricted to Founder, Platform Owner, or Super Admin accounts.", 403, cors);
      }
    }

    const provider = pickProvider(surface);
    if (!provider) {
      return makeError(
        "provider_not_configured",
        "No AI provider is configured. Set AI_API_KEY/AI_BASE_URL/AI_MODEL, or LOVABLE_API_KEY.",
        503,
        cors,
      );
    }

    const persona = PERSONAS[surface];
    const result = await callProvider(provider, persona.system, messages);
    if (!result.ok) {
      return makeError(result.code, result.message, result.status, cors, { provider: provider.kind });
    }

    const content = result.content;

    const reportMatch = content.match(/REPORT\[severity=(info|warn|critical)\]:\s*(.+)/i);
    if (reportMatch && surface !== "chief") {
      const severity = reportMatch[1].toLowerCase();
      const summary = reportMatch[2].trim();
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const svc = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await svc.from("agent_events").insert({
        agent: surface,
        severity,
        title: `${persona.name}: ${summary.slice(0, 80)}`,
        summary,
        payload: { last_user_message: lastUser, provider: provider.kind },
        created_by: userId,
      });
    }

    const cleaned = content.replace(/REPORT\[severity=[^\]]+\]:.*$/i, "").trim();

    return new Response(
      JSON.stringify({ content: cleaned, persona: persona.name, provider: provider.kind }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return makeError("provider_failure", String(e), 500, cors);
  }
});
