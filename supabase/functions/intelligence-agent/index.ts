// Intelligence Agent — structured Firecrawl Agent API extraction per lane.
// Admin-only. Calls Firecrawl /v2/agent with a strict per-lane JSON schema so
// the UI can render semantic tables instead of raw search snippets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

type LaneId = "buyers" | "festivals" | "industry" | "monitor";

type LaneDef = {
  arrayKey: string;
  promptBuilder: (query: string) => string;
  schema: Record<string, unknown>;
};

const LANES: Record<LaneId, LaneDef> = {
  buyers: {
    arrayKey: "companies",
    promptBuilder: (q) =>
      `Identify active content buyers, OTT streamers, broadcasters and distributors matching: "${q}". ` +
      `For each company return name, homepage url, target genres, and any recent acquisitions or licensing deals.`,
    schema: {
      type: "object",
      properties: {
        companies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              url: { type: "string" },
              target_genres: { type: "array", items: { type: "string" } },
              recent_acquisitions: { type: "array", items: { type: "string" } },
              region: { type: "string" },
              notes: { type: "string" },
            },
            required: ["name", "url"],
          },
        },
      },
      required: ["companies"],
    },
  },
  festivals: {
    arrayKey: "festivals",
    promptBuilder: (q) =>
      `Find film festivals with open submissions matching: "${q}". ` +
      `Return festival name, submission deadline (as written), submission URL, location or country, and category if visible.`,
    schema: {
      type: "object",
      properties: {
        festivals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              deadline: { type: "string" },
              submission_url: { type: "string" },
              location: { type: "string" },
              category: { type: "string" },
            },
            required: ["name", "deadline"],
          },
        },
      },
      required: ["festivals"],
    },
  },
  industry: {
    arrayKey: "insights",
    promptBuilder: (q) =>
      `Surface industry news and insights relevant to film/TV production technology for: "${q}". ` +
      `For each item return a headline, source URL, an impact level (High, Medium, or Low), and a one-line summary.`,
    schema: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              headline: { type: "string" },
              source_url: { type: "string" },
              impact_level: { type: "string", enum: ["High", "Medium", "Low"] },
              summary: { type: "string" },
              vendor: { type: "string" },
              topic: { type: "string" },
            },
            required: ["headline", "source_url"],
          },
        },
      },
      required: ["insights"],
    },
  },
  monitor: {
    arrayKey: "alerts",
    promptBuilder: (q) =>
      `Detect brand or competitor mentions relevant to: "${q}" (StreamVista, Crayons Pictures, Frame.io, Netflix, Prime Video). ` +
      `For each mention return the entity, the event or what happened, when it was detected (as written), and a reference URL.`,
    schema: {
      type: "object",
      properties: {
        alerts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entity: { type: "string" },
              event: { type: "string" },
              detected_at: { type: "string" },
              reference_url: { type: "string" },
              sentiment: { type: "string" },
              summary: { type: "string" },
            },
            required: ["entity", "event"],
          },
        },
      },
      required: ["alerts"],
    },
  },
};

async function runAgent(apiKey: string, laneId: LaneId, query: string, model: string) {
  const lane = LANES[laneId];
  const prompt = lane.promptBuilder(query);

  const res = await fetch("https://api.firecrawl.dev/v2/agent", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, model, jsonSchema: lane.schema }),
  });
  const rawBody = await res.text();
  let data: any = null;
  try { data = rawBody ? JSON.parse(rawBody) : null; } catch { /* non-JSON body */ }
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || rawBody.slice(0, 300) || `firecrawl_${res.status}`;
    console.error("intelligence-agent upstream_error", { status: res.status, laneId, message });
    const err: any = new Error(String(message).slice(0, 300));
    err.upstreamStatus = res.status;
    throw err;
  }


  // Firecrawl v2/agent typically returns { success, data: <jsonMatchingSchema>, sources? }
  // Normalize to always emit the lane's array key at the top level plus optional sources.
  const payload =
    (data && typeof data === "object" && (data.data ?? data.result ?? data.json ?? data)) ||
    {};
  const arr = Array.isArray((payload as Record<string, unknown>)[lane.arrayKey])
    ? (payload as Record<string, unknown>)[lane.arrayKey]
    : [];
  const sources: Array<{ title?: string; url?: string }> = Array.isArray(data?.sources)
    ? data.sources
    : Array.isArray(payload?.sources)
      ? payload.sources
      : [];

  return { [lane.arrayKey]: arr, sources };
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userRes } = await supa.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const key = Deno.env.get("FIRECRAWL_API_KEY");
    if (!key) return json({ error: "firecrawl_not_connected" }, 400);

    const body = await req.json().catch(() => ({}));
    const lane = String(body?.lane ?? "") as LaneId;
    const query = String(body?.query ?? body?.prompt ?? "").trim();
    const model = String(body?.model ?? "spark-1-mini");
    if (!LANES[lane]) return json({ error: "unknown_lane" }, 400);
    if (!query) return json({ error: "query_required" }, 400);

    const structured = await runAgent(key, lane, query, model);
    return json({ lane, query, ...structured });
  } catch (e) {
    console.error("intelligence-agent error", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
