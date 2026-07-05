// Intelligence Center snapshots — list, save (manual), and daily cron refresh.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

type LaneQuery = { label: string; query: string };
type LaneDef = { id: string; label: string; category: string; queries: LaneQuery[] };

// Kept in sync with the frontend LANES config.
const LANES: LaneDef[] = [
  {
    id: "buyers",
    label: "Marketplace & Buyers",
    category: "ott",
    queries: [
      { label: "OTT acquisition news (India)", query: "OTT platform content acquisition India 2026" },
      { label: "Global distributors seeking films", query: "film distributor acquisitions looking for indie titles" },
      { label: "Broadcaster licensing deals", query: "television broadcaster licensing deals announcement 2026" },
    ],
  },
  {
    id: "festivals",
    label: "Film Festivals",
    category: "festival",
    queries: [
      { label: "Open submissions this quarter", query: "film festival open for submissions deadline 2026" },
      { label: "Co-production markets", query: "co-production market film 2026 application deadline" },
      { label: "Award-qualifying festivals", query: "Oscar BAFTA qualifying film festival submission 2026" },
    ],
  },
  {
    id: "industry",
    label: "Industry News & Tech",
    category: "studio",
    queries: [
      { label: "AI in post-production", query: "AI post-production workflow announcement 2026" },
      { label: "Cinema camera launches", query: "cinema camera release announcement 2026" },
      { label: "Cloud media workflows", query: "cloud media pipeline camera-to-cloud news 2026" },
    ],
  },
  {
    id: "monitor",
    label: "Brand & Competitor Monitor",
    category: "distributor",
    queries: [
      { label: "StreamVista mentions", query: "StreamVista Cloud X press coverage" },
      { label: "Crayons Pictures mentions", query: "Crayons Pictures film production news" },
      { label: "Competitor moves", query: "Frame.io Netflix Prime Video creator tools announcement 2026" },
    ],
  },
];

const CATEGORY_HINTS: Record<string, string> = {
  ott: "OTT streaming platform",
  festival: "film festival",
  studio: "post-production studio",
  distributor: "film distributor sales agent",
};

async function firecrawlSearch(apiKey: string, category: string, query: string, limit = 8) {
  const hint = CATEGORY_HINTS[category] ?? "";
  const q = hint ? `${query} ${hint}` : query;
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q, limit }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`firecrawl_${res.status}`);
  const items: Array<{ title?: string; url?: string; description?: string; snippet?: string }> =
    Array.isArray(data?.data) ? data.data
      : Array.isArray(data?.web?.results) ? data.web.results
      : Array.isArray(data?.results) ? data.results
      : [];
  return items.slice(0, limit).map((r) => ({
    title: r.title ?? r.url ?? "Untitled",
    url: r.url,
    description: r.description ?? r.snippet ?? "",
  }));
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "list";

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Cron-invoked daily refresh — no user session, uses shared secret.
    if (action === "run_daily") {
      const secret = req.headers.get("x-cron-secret");
      if (!secret || secret !== Deno.env.get("INTELLIGENCE_CRON_SECRET")) {
        return json({ error: "forbidden" }, 403);
      }
      const key = Deno.env.get("FIRECRAWL_API_KEY");
      if (!key) return json({ error: "firecrawl_not_connected" }, 400);

      const lanes: Record<string, { label: string; activeQuery: string; results: unknown[]; error?: string }> = {};
      let total = 0;
      for (const lane of LANES) {
        const q = lane.queries[0];
        try {
          const results = await firecrawlSearch(key, lane.category, q.query, 8);
          lanes[lane.id] = { label: lane.label, activeQuery: q.query, results };
          total += results.length;
        } catch (e) {
          lanes[lane.id] = { label: lane.label, activeQuery: q.query, results: [], error: (e as Error).message };
        }
      }
      const { data, error } = await admin
        .from("intelligence_snapshots")
        .insert({
          source: "cron",
          total_signals: total,
          lanes_count: Object.values(lanes).filter((l) => l.results.length > 0).length,
          payload: { lanes },
        })
        .select("id, created_at")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, snapshot: data, total_signals: total });
    }

    // Everything else requires an authenticated admin.
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
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    if (action === "list") {
      const { data, error } = await admin
        .from("intelligence_snapshots")
        .select("id, created_at, source, total_signals, lanes_count")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return json({ error: error.message }, 500);
      return json({ snapshots: data ?? [] });
    }

    if (action === "get") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id_required" }, 400);
      const { data, error } = await admin
        .from("intelligence_snapshots")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ snapshot: data });
    }

    if (action === "save") {
      const body = await req.json().catch(() => ({}));
      const payload = body?.payload;
      const totalSignals = Number(body?.total_signals ?? 0);
      const lanesCount = Number(body?.lanes_count ?? 0);
      if (!payload || typeof payload !== "object") return json({ error: "payload_required" }, 400);
      const { data, error } = await admin
        .from("intelligence_snapshots")
        .insert({
          source: "manual",
          total_signals: totalSignals,
          lanes_count: lanesCount,
          payload,
          created_by: userId,
        })
        .select("id, created_at")
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, snapshot: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("intelligence-snapshots error", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500);
  }
});
