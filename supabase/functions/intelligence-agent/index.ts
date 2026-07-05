// Intelligence Agent — structured Firecrawl extraction per lane.
// Admin-only. Returns lane-specific structured JSON (companies, festivals, etc.)
// so the UI can render semantic tables instead of raw search snippets.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

type LaneId = "buyers" | "festivals" | "industry" | "monitor";

type LaneDef = {
  hint: string;
  prompt: string;
  schema: Record<string, unknown>;
  arrayKey: string;
};

const LANES: Record<LaneId, LaneDef> = {
  buyers: {
    hint: "OTT streaming platform broadcaster distributor",
    prompt:
      "Extract active content buyers or acquirers mentioned on the page. For each, capture the company name, the genres or content types they target, and any recent acquisitions or licensing deals referenced. Only include companies actively acquiring.",
    arrayKey: "companies",
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
            required: ["name"],
          },
        },
      },
    },
  },
  festivals: {
    hint: "film festival submission deadline",
    prompt:
      "Extract film festivals with open submissions. For each capture name, submission deadline (as written), submission URL, and location or country.",
    arrayKey: "festivals",
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
    },
  },
  industry: {
    hint: "post-production camera AI cloud workflow",
    prompt:
      "Extract industry news items relevant to film/TV production technology. For each capture a headline, the vendor or company involved, the topic (AI, camera, cloud, workflow, distribution) and a one-line summary.",
    arrayKey: "items",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              headline: { type: "string" },
              vendor: { type: "string" },
              topic: { type: "string" },
              summary: { type: "string" },
              url: { type: "string" },
            },
            required: ["headline"],
          },
        },
      },
    },
  },
  monitor: {
    hint: "brand mention press coverage announcement",
    prompt:
      "Extract brand or competitor mentions relevant to StreamVista, Crayons Pictures, Frame.io, Netflix or Prime Video creator tools. Capture brand name, sentiment (positive/neutral/negative), and a one-line summary of what was said.",
    arrayKey: "mentions",
    schema: {
      type: "object",
      properties: {
        mentions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              brand: { type: "string" },
              sentiment: { type: "string" },
              summary: { type: "string" },
              source: { type: "string" },
              url: { type: "string" },
            },
            required: ["brand"],
          },
        },
      },
    },
  },
};

async function runLane(apiKey: string, laneId: LaneId, query: string, limit = 5) {
  const lane = LANES[laneId];
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `${query} ${lane.hint}`,
      limit,
      scrapeOptions: {
        formats: [{ type: "json", schema: lane.schema, prompt: lane.prompt }],
        onlyMainContent: true,
      },
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`firecrawl_${res.status}`);

  const results: Array<{ url?: string; title?: string; json?: Record<string, unknown> }> =
    Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.web?.results) ? data.web.results
      : Array.isArray(data?.results) ? data.results
      : [];

  // Aggregate the target array across all scraped pages.
  const aggregated: Record<string, unknown>[] = [];
  const sources: Array<{ title?: string; url?: string }> = [];
  for (const r of results) {
    const structured = r.json as Record<string, unknown> | undefined;
    if (r.url || r.title) sources.push({ title: r.title, url: r.url });
    const arr = structured?.[lane.arrayKey];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item && typeof item === "object") {
          // Backfill URL from source if item doesn't have one.
          const enriched = { ...(item as Record<string, unknown>) };
          if (!enriched.url && r.url) enriched.url = r.url;
          aggregated.push(enriched);
        }
      }
    }
  }
  return { [lane.arrayKey]: aggregated, sources };
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
    const query = String(body?.query ?? "").trim();
    const limit = Math.min(Math.max(Number(body?.limit ?? 5), 1), 8);
    if (!LANES[lane]) return json({ error: "unknown_lane" }, 400);
    if (!query) return json({ error: "query_required" }, 400);

    const structured = await runLane(key, lane, query, limit);
    return json({ lane, query, ...structured });
  } catch (e) {
    console.error("intelligence-agent error", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
