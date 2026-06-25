// Stable JSON shape for content_titles.metadata so the editor and DB
// agree without altering the existing column structure.
import { z } from "zod";

export const PersonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(200).default(""),
});

export const FestivalSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  award: z.string().trim().max(200).optional().default(""),
  selection_type: z.string().trim().max(80).optional().default(""),
  location: z.string().trim().max(160).optional().default(""),
  url: z.string().trim().max(500).optional().default(""),
});

export const AwardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  category: z.string().trim().max(200).optional().default(""),
  result: z.string().trim().max(80).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export const TitleMetadataSchema = z.object({
  synopsis: z.string().max(5000).default(""),
  genres: z.array(z.string().trim().max(60)).default([]),
  keywords: z.array(z.string().trim().max(60)).default([]),
  format: z.enum([
    "feature_film", "web_series", "tv_series", "short_film",
    "documentary", "music_video", "animation",
    // legacy values kept for backwards-compat with older rows.
    "trailer", "short", "teaser", "wip", "series",
    "other",
  ]).default("feature_film"),
  runtime_minutes: z.number().int().min(0).max(100000).default(0),
  production_company: z.string().max(200).default(""),
  owner: z.string().max(200).default(""),
  // Crayons Bridge future-readiness fields (stored in metadata JSON, no migrations needed).
  original_language: z.string().max(60).default(""),
  production_year: z.number().int().min(1900).max(2100).nullable().default(null),
  country_of_origin: z.string().max(60).default(""),
  rights_owner: z.string().max(200).default(""),
  countries: z.array(z.string().trim().max(60)).default([]),
  cast: z.array(PersonSchema).default([]),
  crew: z.array(PersonSchema).default([]),
  imdb_id: z.string().max(50).default(""),
  tmdb_id: z.string().max(50).default(""),
  festivals: z.array(FestivalSchema).default([]),
  awards: z.array(AwardSchema).default([]),
  ratings: z.object({
    imdb: z.number().min(0).max(10).optional().nullable(),
    system: z.string().max(60).default(""),
  }).default({ imdb: null, system: "" }),
  advisory: z.string().max(2000).default(""),
  copyright: z.string().max(500).default(""),
  rights: z.object({
    territories: z.array(z.string().trim().max(60)).default([]),
    windows: z.string().max(2000).default(""),
    exclusivity: z.enum(["exclusive", "non_exclusive", "unspecified"]).default("unspecified"),
    notes: z.string().max(2000).default(""),
  }).default({ territories: [], windows: "", exclusivity: "unspecified", notes: "" }),
  tags: z.array(z.string().trim().max(60)).default([]),
  notes: z.string().max(5000).default(""),
});

export type TitleMetadata = z.infer<typeof TitleMetadataSchema>;

export const emptyMetadata = (): TitleMetadata => TitleMetadataSchema.parse({});

export const ASSET_CATEGORIES = [
  // MVP categories — match DB title_assets_category_check + RPC names.
  "feature_film",
  "trailer",
  "poster",
  "censor_certificate",
  "ownership_documents",
  // Future / non-MVP — still allowed by DB constraint, surfaced as "Coming Soon" in UI.
  "captions",
  "audio_tracks",
  "artwork",
  // Legacy aliases retained for backwards compatibility with older rows.
  "subtitle",
  "audio",
  "censor_cert",
  "legal",
  "sales",
  "ownership",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** Categories required for MVP submission (server-enforced by submit_title_to_admin). */
export const MVP_CATEGORIES = [
  "feature_film",
  "trailer",
  "poster",
  "censor_certificate",
  "ownership_documents",
] as const satisfies ReadonlyArray<AssetCategory>;

export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  feature_film: "Feature Film",
  trailer: "Trailer",
  poster: "Poster",
  censor_certificate: "Censor Certificate",
  ownership_documents: "Ownership Documents",
  captions: "Captions",
  audio_tracks: "Audio Tracks",
  artwork: "Artwork",
  subtitle: "Subtitle Files",
  audio: "Audio Tracks",
  censor_cert: "Censor Certificate",
  legal: "Legal Documents",
  sales: "Sales Materials",
  ownership: "Ownership Documents",
};

/** Formats that require a censor certificate before submission. */
export const REQUIRES_CENSOR: ReadonlyArray<TitleMetadata["format"]> = ["feature_film"];

/** User-facing content-type choices captured at title creation. */
export const CONTENT_TYPE_OPTIONS: ReadonlyArray<{
  value: TitleMetadata["format"];
  label: string;
  hint?: string;
}> = [
  { value: "feature_film", label: "Feature Film",  hint: "Theatrical / OTT feature" },
  { value: "web_series",   label: "Web Series",    hint: "Episodic for streaming" },
  { value: "tv_series",    label: "TV Series",     hint: "Episodic for broadcast" },
  { value: "short_film",   label: "Short Film" },
  { value: "documentary",  label: "Documentary" },
  { value: "music_video",  label: "Music Video" },
  { value: "animation",    label: "Animation" },
  { value: "other",        label: "Other",         hint: "Anything else" },
];

export const CONTENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CONTENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);
