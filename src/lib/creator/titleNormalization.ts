// Canonical normalization helpers for content_titles.
//
// Establishes a single source of truth between the canonical top-level
// columns (title, synopsis, language, genre, duration_minutes) and their
// metadata JSON counterparts (original_language, genres, runtime_minutes,
// synopsis). Rules:
//
//  * Empty string / null / whitespace-only / zero are treated as "absent".
//  * A valid value on either side is never overwritten by an absent value.
//  * When both sides carry different valid values, the canonical column wins
//    for reads (source-of-truth) but the conflict is reported for review.
//  * Helpers are pure and safe to call from tests, importers and UI code.

import type { TitleMetadata } from "./titleSchema";

export type CanonicalTitleFields = {
  title: string | null;
  synopsis: string | null;
  language: string | null;
  genre: string | null;
  duration_minutes: number | null;
};

export type CanonicalConflict = {
  field: "synopsis" | "language" | "genre" | "duration_minutes";
  canonical: string | number | null;
  metadata: string | number | null;
};

const isBlank = (v: unknown): boolean =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

export const normalizeTitle = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t.slice(0, 300) : null;
};

export const normalizeSynopsis = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t.slice(0, 5000) : null;
};

export const normalizeLanguage = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  // Title-case first letters so "english" and "ENGLISH" collapse to "English".
  return t.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 60);
};

/** Accepts an array or a comma/pipe-delimited string. Returns a cleaned array. */
export const normalizeGenres = (v: unknown): string[] => {
  let arr: unknown[] = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string" && v.trim()) arr = v.split(/[,|]/);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const g = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!g) continue;
    const cased = g.replace(/\b\w/g, (c) => c.toUpperCase());
    const key = cased.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cased);
  }
  return out;
};

/** Primary genre used for the canonical `genre` string column. */
export const primaryGenre = (v: unknown): string | null => {
  const g = normalizeGenres(v);
  return g.length ? g[0] : null;
};

export const normalizeDurationMinutes = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const int = Math.round(n);
  if (int <= 0) return null;
  if (int > 100000) return null;
  return int;
};

/**
 * Merge a partial patch coming from the UI with the current row so that:
 *   - canonical columns and metadata JSON stay in sync
 *   - valid stored values are never clobbered by empty inputs
 *   - conflicts (both sides valid, different) are returned for review
 *
 * The function does not mutate its inputs.
 */
export function syncCanonicalAndMetadata(
  current: { canonical?: Partial<CanonicalTitleFields>; metadata?: Partial<TitleMetadata> } | null,
  patch: { canonical?: Partial<CanonicalTitleFields>; metadata?: Partial<TitleMetadata> },
): {
  canonical: CanonicalTitleFields;
  metadata: Partial<TitleMetadata>;
  conflicts: CanonicalConflict[];
} {
  const cur = current ?? {};
  const curCanon = cur.canonical ?? {};
  const curMeta = cur.metadata ?? {};
  const pCanon = patch.canonical ?? {};
  const pMeta = patch.metadata ?? {};
  const conflicts: CanonicalConflict[] = [];

  // Helper: pick the first non-blank normalized value from an ordered list.
  const pick = <T>(fn: (v: unknown) => T | null, sources: unknown[]): T | null => {
    for (const s of sources) {
      if (isBlank(s)) continue;
      const n = fn(s);
      if (n !== null && n !== "" && n !== 0) return n;
    }
    return null;
  };

  // ---- title ----
  const title = pick(normalizeTitle, [pCanon.title, curCanon.title]);

  // ---- synopsis (canonical + metadata.synopsis) ----
  const synopsisPatch = pick(normalizeSynopsis, [pCanon.synopsis, pMeta.synopsis]);
  const synopsisCur = pick(normalizeSynopsis, [curCanon.synopsis, curMeta.synopsis]);
  const synopsis = synopsisPatch ?? synopsisCur;
  if (
    synopsisPatch && synopsisCur && synopsisPatch !== synopsisCur &&
    !isBlank(pCanon.synopsis) && !isBlank(curCanon.synopsis) &&
    normalizeSynopsis(pCanon.synopsis) !== normalizeSynopsis(curCanon.synopsis) &&
    !isBlank(curMeta.synopsis) &&
    normalizeSynopsis(pMeta.synopsis) &&
    normalizeSynopsis(curMeta.synopsis) &&
    normalizeSynopsis(pMeta.synopsis) !== normalizeSynopsis(curMeta.synopsis)
  ) {
    // Only emit a conflict when patch supplied both sides with distinct valid values.
    conflicts.push({ field: "synopsis", canonical: synopsisPatch, metadata: normalizeSynopsis(pMeta.synopsis) });
  }

  // ---- language (canonical.language <-> metadata.original_language) ----
  const langPatch = pick(normalizeLanguage, [pCanon.language, pMeta.original_language]);
  const langCur = pick(normalizeLanguage, [curCanon.language, curMeta.original_language]);
  const language = langPatch ?? langCur;
  const pLangCanon = normalizeLanguage(pCanon.language);
  const pLangMeta = normalizeLanguage(pMeta.original_language);
  if (pLangCanon && pLangMeta && pLangCanon !== pLangMeta) {
    conflicts.push({ field: "language", canonical: pLangCanon, metadata: pLangMeta });
  }

  // ---- genres (canonical.genre <-> metadata.genres) ----
  const genresPatch = normalizeGenres(pMeta.genres ?? []);
  const genresCur = normalizeGenres(curMeta.genres ?? []);
  const primaryPatch = pick(primaryGenre, [pCanon.genre, genresPatch]);
  const primaryCur = pick(primaryGenre, [curCanon.genre, genresCur]);
  const genre = primaryPatch ?? primaryCur;
  const finalGenres = genresPatch.length ? genresPatch : genresCur;
  const pGenreCanon = normalizeTitle(pCanon.genre);
  if (pGenreCanon && genresPatch.length && pGenreCanon !== genresPatch[0]) {
    conflicts.push({ field: "genre", canonical: pGenreCanon, metadata: genresPatch[0] });
  }

  // ---- duration_minutes (canonical <-> metadata.runtime_minutes) ----
  const durPatch = pick(normalizeDurationMinutes, [pCanon.duration_minutes, pMeta.runtime_minutes]);
  const durCur = pick(normalizeDurationMinutes, [curCanon.duration_minutes, curMeta.runtime_minutes]);
  const duration_minutes = durPatch ?? durCur;
  const pDurCanon = normalizeDurationMinutes(pCanon.duration_minutes);
  const pDurMeta = normalizeDurationMinutes(pMeta.runtime_minutes);
  if (pDurCanon && pDurMeta && pDurCanon !== pDurMeta) {
    conflicts.push({ field: "duration_minutes", canonical: pDurCanon, metadata: pDurMeta });
  }

  const canonical: CanonicalTitleFields = {
    title,
    synopsis,
    language,
    genre,
    duration_minutes,
  };

  const metadata: Partial<TitleMetadata> = {
    ...pMeta,
    synopsis: synopsis ?? "",
    original_language: language ?? "",
    genres: finalGenres,
    runtime_minutes: duration_minutes ?? 0,
  };

  return { canonical, metadata, conflicts };
}

/**
 * Minimal-fields gate for draft persistence. Autosave must succeed with only
 * a title present; strict submission validation runs elsewhere.
 */
export function hasMinimalDraftFields(patch: {
  canonical?: Partial<CanonicalTitleFields>;
  metadata?: Partial<TitleMetadata>;
}): boolean {
  const t = normalizeTitle(patch.canonical?.title);
  return !!t;
}
