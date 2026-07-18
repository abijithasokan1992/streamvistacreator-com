import { emptyMetadata, type TitleMetadata } from "./titleSchema";

export type LegacySourceTable = "films_film" | "films_filmdraft";

export type LegacyFilmRow = {
  id: number | string;
  uuid?: string | null;
  title?: string | null;
  description?: string | null;
  content_type?: string | null;
  director?: string | null;
  producer?: string | null;
  cast?: string | null;
  duration?: number | string | null;
  language?: string | null;
  country?: string | null;
  release_date?: string | null;
  distribution_territories?: string | null;
  rights_available?: string | null;
  budget?: number | string | null;
};

export type LegacyFilmDraftRow = LegacyFilmRow & {
  completed_tabs?: unknown;
  current_tab?: string | null;
  licensing_terms?: string | null;
  tags?: string | null;
};

export type LegacyTitleImport = {
  legacy_source_table: LegacySourceTable;
  legacy_source_id: string;
  legacy_source_uuid: string | null;
  title: string;
  synopsis: string | null;
  language: string | null;
  duration_minutes: number | null;
  metadata: TitleMetadata;
};

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();

const positiveMinutes = (value: unknown): number | null => {
  const raw = text(value);
  if (!/^\d{1,5}$/.test(raw)) return null;
  const minutes = Number(raw);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 14400 ? minutes : null;
};

const formatFromLegacy = (value: unknown): TitleMetadata["format"] => {
  const key = text(value).toLowerCase().replace(/[\s-]+/g, "_");
  const map: Record<string, TitleMetadata["format"]> = {
    feature: "feature_film",
    feature_film: "feature_film",
    film: "feature_film",
    movie: "feature_film",
    short: "short_film",
    short_film: "short_film",
    documentary: "documentary",
    web_series: "web_series",
    tv_series: "tv_series",
    series: "series",
    music_video: "music_video",
    animation: "animation",
  };
  return map[key] ?? "other";
};

const yearFromDate = (value: unknown): number | null => {
  const match = text(value).match(/^(19|20)\d{2}/);
  return match ? Number(match[0]) : null;
};

function mapLegacy(
  sourceTable: LegacySourceTable,
  row: LegacyFilmRow | LegacyFilmDraftRow,
): LegacyTitleImport {
  const title = text(row.title) || "Untitled";
  const synopsis = text(row.description);
  const language = text(row.language);
  const country = text(row.country);
  const releaseDate = text(row.release_date);
  const duration = positiveMinutes(row.duration);
  const director = text(row.director);
  const producer = text(row.producer);
  const rights = text(row.rights_available);
  const territories = text(row.distribution_territories);

  const metadata: TitleMetadata = {
    ...emptyMetadata(),
    synopsis,
    format: formatFromLegacy(row.content_type),
    runtime_minutes: duration ?? 0,
    original_language: language,
    country_of_origin: country,
    countries: country ? [country] : [],
    production_year: yearFromDate(releaseDate),
    release_date: releaseDate,
    crew: [
      ...(director ? [{ name: director, role: "Director" }] : []),
      ...(producer ? [{ name: producer, role: "Producer" }] : []),
    ],
    original_title: title,
    rights: {
      ...emptyMetadata().rights,
      territories: territories ? [territories] : [],
      notes: rights,
    },
    notes: sourceTable === "films_filmdraft"
      ? "Imported from the legacy Crayons draft export."
      : "Imported from the legacy Crayons film export.",
  };

  return {
    legacy_source_table: sourceTable,
    legacy_source_id: String(row.id),
    legacy_source_uuid: text(row.uuid) || null,
    title,
    synopsis: synopsis || null,
    language: language || null,
    duration_minutes: duration,
    metadata,
  };
}

export const mapLegacyFilmRow = (row: LegacyFilmRow): LegacyTitleImport =>
  mapLegacy("films_film", row);

export const mapLegacyFilmDraftRow = (row: LegacyFilmDraftRow): LegacyTitleImport =>
  mapLegacy("films_filmdraft", row);

export const legacyImportKey = (
  row: Pick<LegacyTitleImport, "legacy_source_table" | "legacy_source_id">,
): string => `${row.legacy_source_table}:${row.legacy_source_id}`;
