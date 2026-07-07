// tmdb-lookup — StreamVista metadata provider proxy for TMDb.
//
// Security:
//  - TMDB_API_KEY stays server-side.
//  - Requires authenticated Supabase user (JWT). Uses existing auth.
//  - CORS via shared allow-list.
//
// Actions:
//   { action: "search", query: string, year?: number, kind?: "movie"|"tv" }
//     -> { results: [{ id, kind, title, original_title, year, overview, poster_url, popularity }] }
//   { action: "details", id: number, kind: "movie"|"tv" }
//     -> normalized details payload with credits + videos.
//
// The AI layer (title-autofill) is the only caller that mixes AI reasoning
// with these results — but the raw payload here comes exclusively from TMDb,
// so the AI can never invent verified fields.

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, handleOptions } from "../_shared/cors.ts";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";

function tmdbAuthHeaders(): HeadersInit {
  const key = Deno.env.get("TMDB_API_KEY") ?? "";
  // v4 read-access tokens are JWT-shaped ("."-separated); v3 keys are 32 hex.
  if (key.includes(".")) {
    return { Authorization: `Bearer ${key}`, Accept: "application/json" };
  }
  return { Accept: "application/json" };
}

function tmdbUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const key = Deno.env.get("TMDB_API_KEY") ?? "";
  const url = new URL(TMDB_BASE + path);
  if (!key.includes(".") && key) url.searchParams.set("api_key", key);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function tmdbFetch(path: string, params: Record<string, string | number | undefined> = {}) {
  const res = await fetch(tmdbUrl(path, params), { headers: tmdbAuthHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`tmdb_${res.status}:${text.slice(0, 200)}`);
  }
  return res.json();
}

function friendlyError(status: number, message: string) {
  const map: Record<number, string> = {
    401: "The metadata service is not configured. Please contact support.",
    403: "This request was not permitted by the metadata service.",
    404: "We couldn't find a match. Please try a different title or year.",
    429: "The metadata service is busy. Please try again in a moment.",
  };
  return map[status] ?? message ?? "The metadata service could not respond. Please try again.";
}

function posterUrl(path: string | null | undefined, size = "w500"): string {
  if (!path) return "";
  return `${IMG_BASE}/${size}${path}`;
}

function pickYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const y = Number(String(dateStr).slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

async function requireUser(req: Request): Promise<{ userId: string } | Response> {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!url || !anon) {
    return new Response(JSON.stringify({ error: "Service unavailable. Please try again." }), { status: 503 });
  }
  const supa = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) {
    return new Response(JSON.stringify({ error: "Please sign in to continue." }), { status: 401 });
  }
  return { userId: data.user.id };
}

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

    if (!Deno.env.get("TMDB_API_KEY")) {
      return json({ error: "The metadata service is not configured yet." }, 503);
    }

    const body = await req.json().catch(() => ({} as any));
    const action = String(body.action ?? "search");

    if (action === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) return json({ error: "Please enter a title to search." }, 400);
      const year = Number.isFinite(Number(body.year)) ? Number(body.year) : undefined;
      const kind = body.kind === "tv" ? "tv" : body.kind === "movie" ? "movie" : "multi";

      const path = kind === "multi" ? "/search/multi" : `/search/${kind}`;
      const params: Record<string, string | number | undefined> = { query, include_adult: "false", language: "en-US" };
      if (year && kind === "movie") params.year = year;
      if (year && kind === "tv") params.first_air_date_year = year;

      const data = await tmdbFetch(path, params);
      const results = (data.results ?? [])
        .filter((r: any) => r.media_type ? (r.media_type === "movie" || r.media_type === "tv") : true)
        .slice(0, 15)
        .map((r: any) => {
          const isTv = (r.media_type ?? kind) === "tv";
          const title = isTv ? (r.name ?? r.original_name ?? "") : (r.title ?? r.original_title ?? "");
          const original_title = isTv ? (r.original_name ?? "") : (r.original_title ?? "");
          const date = isTv ? r.first_air_date : r.release_date;
          return {
            id: r.id,
            kind: isTv ? "tv" : "movie",
            title,
            original_title,
            year: pickYear(date),
            overview: r.overview ?? "",
            poster_url: posterUrl(r.poster_path, "w342"),
            popularity: r.popularity ?? 0,
          };
        });
      return json({ results });
    }

    if (action === "details") {
      const id = Number(body.id);
      const kind = body.kind === "tv" ? "tv" : "movie";
      if (!Number.isFinite(id) || id <= 0) return json({ error: "Please pick a title from the results." }, 400);

      const data = await tmdbFetch(`/${kind}/${id}`, {
        language: "en-US",
        append_to_response: "credits,videos,release_dates,external_ids,images",
      });

      const credits = data.credits ?? {};
      const cast = (credits.cast ?? []).slice(0, 20).map((p: any) => ({
        name: String(p.name ?? "").trim(),
        role: String(p.character ?? "").trim(),
      })).filter((p: any) => p.name);
      const crew = (credits.crew ?? [])
        .filter((p: any) => ["Director", "Producer", "Executive Producer", "Writer", "Screenplay", "Story", "Director of Photography", "Editor", "Composer", "Music"].includes(p.job))
        .slice(0, 25)
        .map((p: any) => ({ name: String(p.name ?? "").trim(), role: String(p.job ?? "").trim() }))
        .filter((p: any) => p.name);

      const runtime =
        kind === "movie"
          ? Number(data.runtime ?? 0) || 0
          : Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
            ? Number(data.episode_run_time[0]) || 0
            : 0;

      const trailer = ((data.videos?.results ?? []) as any[]).find(
        (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"),
      );
      const trailer_url = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "";

      const genres = (data.genres ?? []).map((g: any) => String(g.name ?? "").trim()).filter(Boolean);
      const countries = (data.production_countries ?? []).map((c: any) => String(c.name ?? "").trim()).filter(Boolean);
      const languages = (data.spoken_languages ?? []).map((l: any) => String(l.english_name ?? l.name ?? "").trim()).filter(Boolean);
      const production_companies = (data.production_companies ?? []).map((c: any) => String(c.name ?? "").trim()).filter(Boolean);

      const releaseDate = kind === "movie" ? (data.release_date ?? "") : (data.first_air_date ?? "");

      return json({
        details: {
          id: data.id,
          kind,
          title: kind === "movie" ? (data.title ?? "") : (data.name ?? ""),
          original_title: kind === "movie" ? (data.original_title ?? "") : (data.original_name ?? ""),
          synopsis: data.overview ?? "",
          genres,
          runtime_minutes: runtime,
          original_language: languages[0] ?? "",
          languages,
          countries,
          country_of_origin: countries[0] ?? "",
          production_year: pickYear(releaseDate),
          release_date: releaseDate,
          production_companies,
          cast,
          crew,
          poster_url: posterUrl(data.poster_path, "w500"),
          backdrop_url: posterUrl(data.backdrop_path, "w780"),
          trailer_url,
          imdb_id: data.external_ids?.imdb_id ?? data.imdb_id ?? "",
          tmdb_id: String(data.id ?? ""),
          source: "tmdb",
        },
      });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const m = /^tmdb_(\d+):/.exec(msg);
    const status = m ? Number(m[1]) : 500;
    return new Response(
      JSON.stringify({ error: friendlyError(status, "The metadata service could not respond. Please try again.") }),
      { status: status >= 400 && status < 600 ? status : 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
