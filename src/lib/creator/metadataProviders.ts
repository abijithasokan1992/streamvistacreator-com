// Provider-agnostic client for the Smart Metadata Import flow.
//
// The UI never talks to a provider directly — it calls the `title-autofill`
// edge function, which dispatches to the current provider (TMDb today,
// StreamVista Internal Library / EPK AI / enterprise providers next).
// Adding a provider is a server-side change; this client stays identical.

import { supabase } from "@/integrations/supabase/client";

export type MetadataProviderId = "tmdb" | "streamvista_library" | "epk_ai" | "enterprise";

export interface MetadataSearchResult {
  provider: string;
  id: string | number;
  kind: "movie" | "tv";
  title: string;
  original_title: string;
  year: number | null;
  overview: string;
  poster_url: string;
}

export interface MetadataPreview {
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

async function invoke<T>(action: "search" | "preview", body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("title-autofill", {
    body: { action, provider: "tmdb", ...body },
  });
  if (error) {
    const msg = (error as any)?.message || "We couldn't reach the metadata service. Please try again.";
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in (data as any)) {
    throw new Error(String((data as any).error));
  }
  return data as T;
}

// In-memory per-session cache so repeated searches / previews don't re-hit the
// edge function. Cleared on page reload; no persistent storage.
const searchCache = new Map<string, MetadataSearchResult[]>();
const previewCache = new Map<string, MetadataPreview>();

export async function searchMetadata(query: string, opts: { year?: number; kind?: "movie" | "tv" } = {}) {
  const key = `${(opts.kind ?? "any")}::${(opts.year ?? "")}::${query.trim().toLowerCase()}`;
  const cached = searchCache.get(key);
  if (cached) return cached;
  const data = await invoke<{ provider: string; results: MetadataSearchResult[] }>("search", {
    query,
    year: opts.year,
    kind: opts.kind,
  });
  const results = data.results ?? [];
  searchCache.set(key, results);
  return results;
}

export async function previewMetadata(id: string | number, kind: "movie" | "tv") {
  const key = `${kind}::${id}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  const data = await invoke<{ provider: string; preview: MetadataPreview }>("preview", { id, kind });
  previewCache.set(key, data.preview);
  return data.preview;
}

/**
 * Fields that Smart Metadata Import is allowed to populate.
 * Rights, licensing, commercial, legal and pricing fields are intentionally
 * excluded — those remain creator-controlled at all times.
 */
export const IMPORTABLE_FIELDS = [
  "title",
  "original_title",
  "synopsis",
  "genres",
  "runtime_minutes",
  "original_language",
  "country_of_origin",
  "production_year",
  "release_date",
  "production_company",
  "cast",
  "crew",
  "imdb_id",
  "tmdb_id",
  "poster_url",
  "trailer_url",
] as const;
export type ImportableField = (typeof IMPORTABLE_FIELDS)[number];
