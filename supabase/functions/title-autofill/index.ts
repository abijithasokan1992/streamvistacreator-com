// title-autofill — Provider-agnostic Smart Metadata Import.
//
// This function is the single entry point the Creator UI calls. It selects
// a metadata provider (currently TMDb) and, for a chosen candidate, returns
// a normalized preview shaped to the existing Title Workspace schema.
//
// The AI Gateway (Gemini function-calling) is used only to normalize verified
// provider data into StreamVista's field shapes — it must never invent values.
// If the provider returns nothing for a field, we return an empty value and
// the UI shows "Not available. Please enter manually."
//
// Actions:
//   { action: "search",  provider?, query, year?, kind? }
//     -> { provider, results: [...] }
//   { action: "preview", provider?, id, kind }
//     -> { provider, preview: { fields..., poster_url, trailer_url } }
//
// Provider-based architecture — add new providers by extending PROVIDERS.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

type Kind = "movie" | "tv";

interface SearchResult {
  provider: string;
  id: string | number;
  kind: Kind;
  title: string;
  original_title: string;
  year: number | null;
  overview: string;
  poster_url: string;
}

interface PreviewFields {
  title: string;
  original_title: string;
  synopsis: string;
  genres: string[];
  runtime_minutes: number;
  original_language: string;
  country_of_origin: string;
  production_year: number | null;
  release_date: string;
  production_company: string;
  cast: { name: string; role: string }[];
  crew: { name: string; role: string }[];
  imdb_id: string;
  tmdb_id: string;
  poster_url: string;
  trailer_url: string;
  source: string;
}

interface Provider {
  id: string;
  label: string;
  search(query: string, opts: { year?: number; kind?: Kind }, authHeader: string): Promise<SearchResult[]>;
  preview(id: string | number, kind: Kind, authHeader: string): Promise<PreviewFields>;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

async function invokeInternal(fn: string, body: unknown, authHeader: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "The metadata service could not respond. Please try again.");
  return data;
}

const tmdbProvider: Provider = {
  id: "tmdb",
  label: "TMDb",
  async search(query, opts, authHeader) {
    const data = await invokeInternal("tmdb-lookup", { action: "search", query, year: opts.year, kind: opts.kind }, authHeader);
    return (data.results ?? []).map((r: any) => ({
      provider: "tmdb",
      id: r.id,
      kind: r.kind,
      title: r.title,
      original_title: r.original_title,
      year: r.year,
      overview: r.overview,
      poster_url: r.poster_url,
    }));
  },
  async preview(id, kind, authHeader) {
    const data = await invokeInternal("tmdb-lookup", { action: "details", id, kind }, authHeader);
    const d = data.details ?? {};
    return {
      title: d.title ?? "",
      original_title: d.original_title ?? "",
      synopsis: d.synopsis ?? "",
      genres: normalizeGenres(d.genres ?? []),
      runtime_minutes: Number(d.runtime_minutes ?? 0) || 0,
      original_language: normalizeLanguage(d.original_language ?? ""),
      country_of_origin: normalizeCountry(d.country_of_origin ?? ""),
      production_year: d.production_year ?? null,
      release_date: String(d.release_date ?? ""),
      production_company: Array.isArray(d.production_companies) ? String(d.production_companies[0] ?? "") : "",
      cast: Array.isArray(d.cast) ? d.cast.slice(0, 20) : [],
      crew: Array.isArray(d.crew) ? d.crew.slice(0, 25) : [],
      imdb_id: d.imdb_id ?? "",
      tmdb_id: d.tmdb_id ?? "",
      poster_url: d.poster_url ?? "",
      trailer_url: d.trailer_url ?? "",
      source: "tmdb",
    };
  },
};

const PROVIDERS: Record<string, Provider> = {
  tmdb: tmdbProvider,
  // Future: streamvista_library, epk_ai, enterprise
};

// -------- Normalizers (verified data in → StreamVista-shape out) --------

const GENRE_MAP: Record<string, string> = {
  "science fiction": "Sci-Fi",
  "sci-fi & fantasy": "Sci-Fi",
  "action & adventure": "Action",
  "tv movie": "Drama",
  "war & politics": "War",
  "kids": "Family",
  "reality": "Documentary",
  "news": "Documentary",
  "soap": "Drama",
  "talk": "Documentary",
};
const GENRE_ALLOW = new Set([
  "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Fantasy", "History", "Horror", "Music", "Musical", "Mystery", "Romance",
  "Sci-Fi", "Sport", "Thriller", "War", "Western",
]);
function normalizeGenres(input: string[]): string[] {
  const out: string[] = [];
  for (const raw of input) {
    const g = String(raw ?? "").trim();
    if (!g) continue;
    const mapped = GENRE_MAP[g.toLowerCase()] ?? g;
    const cased = mapped.replace(/\b\w/g, (c) => c.toUpperCase());
    const final = GENRE_ALLOW.has(cased) ? cased : "";
    if (final && !out.includes(final)) out.push(final);
  }
  return out;
}

const LANG_MAP: Record<string, string> = {
  "mandarin chinese": "Mandarin",
  "chinese": "Mandarin",
  "putonghua": "Mandarin",
};
function normalizeLanguage(v: string): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const mapped = LANG_MAP[s.toLowerCase()] ?? s;
  return mapped.replace(/\b\w/g, (c) => c.toUpperCase());
}

const COUNTRY_MAP: Record<string, string> = {
  "United States of America": "United States",
  "USA": "United States",
  "US": "United States",
  "UK": "United Kingdom",
};
function normalizeCountry(v: string): string {
  const s = String(v ?? "").trim();
  return COUNTRY_MAP[s] ?? s;
}

// -------- Auth --------

async function requireUser(req: Request): Promise<{ userId: string; authHeader: string } | Response> {
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!SUPABASE_URL || !anon) {
    return new Response(JSON.stringify({ error: "Service unavailable. Please try again." }), { status: 503 });
  }
  const supa = createClient(SUPABASE_URL, anon, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: "Please sign in to continue." }), { status: 401 });
  }
  return { userId: data.user.id, authHeader };
}

// -------- Handler --------

Deno.serve(async (req: Request) => {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") return handleOptions(req);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const gate = await requireUser(req);
    if (gate instanceof Response) {
      return new Response(gate.body, { status: gate.status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action ?? "search");
    const providerId = String(body.provider ?? "tmdb");
    const provider = PROVIDERS[providerId];
    if (!provider) return json({ error: "That metadata source is not available yet." }, 400);

    if (action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "Please enter a title to search." }, 400);
      const year = Number.isFinite(Number(body.year)) && Number(body.year) > 1800 ? Number(body.year) : undefined;
      const kind = body.kind === "tv" || body.kind === "movie" ? body.kind : undefined;
      const results = await provider.search(query, { year, kind }, gate.authHeader);
      return json({ provider: providerId, results });
    }

    if (action === "preview") {
      const id = body.id;
      const kind = body.kind === "tv" ? "tv" : "movie";
      if (id === undefined || id === null || id === "") {
        return json({ error: "Please pick a title from the results." }, 400);
      }
      const preview = await provider.preview(id, kind, gate.authHeader);
      return json({ provider: providerId, preview });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "The metadata service could not respond. Please try again.";
    return new Response(JSON.stringify({ error: msg }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
