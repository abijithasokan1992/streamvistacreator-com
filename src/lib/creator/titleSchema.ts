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

/**
 * Award result enum — canonical values enforced by the smart importer and
 * the inline editor. Empty string is accepted for backwards compatibility
 * with legacy rows written before the enum was introduced.
 */
export const AWARD_RESULTS = ["Won", "Nominated", "Shortlisted", "Honourable Mention"] as const;
export type AwardResult = (typeof AWARD_RESULTS)[number];
export const AwardResultSchema = z.union([z.enum(AWARD_RESULTS), z.literal("")]);

export const AwardSchema = z.object({
  name: z.string().trim().min(1, "award_name is required").max(200),
  issuing_body: z.string().trim().max(200).optional().default(""),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  category: z.string().trim().max(200).optional().default(""),
  result: AwardResultSchema.optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});
export type AwardRow = z.infer<typeof AwardSchema>;

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
  original_title: z.string().max(300).default(""),
  release_date: z.string().max(40).default(""),
  trailer_url: z.string().max(500).default(""),
  festivals: z.array(FestivalSchema).default([]),
  awards: z.array(AwardSchema).default([]),
  ratings: z.object({
    imdb: z.number().min(0).max(10).optional().nullable(),
    system: z.string().max(60).default(""),
  }).default({ imdb: null, system: "" }),
  advisory: z.string().max(2000).default(""),
  certification: z.enum(["U", "U/A", "A", "S", "unrated", "other", ""]).default(""),
  copyright: z.string().max(500).default(""),
  rights: z.object({
    territories: z.array(z.string().trim().max(60)).default([]),
    windows: z.string().max(2000).default(""),
    exclusivity: z.enum(["exclusive", "non_exclusive", "unspecified"]).default("unspecified"),
    notes: z.string().max(2000).default(""),
  }).default({ territories: [], windows: "", exclusivity: "unspecified", notes: "" }),
  commercial: z.object({
    engagement_mode: z.enum(["free_listing", "go_free", "upgrade_premium", "unspecified"]).default("free_listing"),
    exclusivity: z.enum(["exclusive", "non_exclusive", "unspecified"]).default("non_exclusive"),
    deal_model: z.enum(["revenue_share", "mg", "outright", "open", "unspecified"]).default("revenue_share"),
    min_deal_value: z.number().min(0).max(1_000_000_000).nullable().default(null),
    open_to_investors: z.boolean().default(false),
    rights: z.record(z.string(), z.enum([
      "none", "available", "sold", "not_available", "discuss", "premium_required",
    ])).default({
      digital_ott: "available",
      satellite: "available",
      youtube_avod: "available",
    }),
    territories: z.record(z.string(), z.enum([
      "none", "available", "sold", "blocked", "discuss",
    ])).default({ worldwide: "available" }),
    notes: z.string().max(2000).default(""),
  }).default({
    engagement_mode: "free_listing",
    exclusivity: "non_exclusive",
    deal_model: "revenue_share",
    min_deal_value: null,
    open_to_investors: false,
    rights: { digital_ott: "available", satellite: "available", youtube_avod: "available" },
    territories: { worldwide: "available" },
    notes: "",
  }),
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

/** Categories surfaced in the MVP submission workspace. */
export const MVP_CATEGORIES = [
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

/* -------- Rights Availability & Distribution Preferences -------- */

export type RightStatus = "none" | "available" | "sold" | "not_available" | "discuss" | "premium_required";
export type TerritoryStatus = "none" | "available" | "sold" | "blocked" | "discuss";
export type EngagementMode = "free_listing" | "go_free" | "upgrade_premium" | "unspecified";

export const RIGHTS_CATALOG: ReadonlyArray<{
  key: string;
  label: string;
  group: "core" | "premium";
  hint?: string;
}> = [
  // Core — included in free listing scope
  { key: "digital_ott",   label: "Digital / OTT",                 group: "core" },
  { key: "satellite",     label: "Satellite / TV Broadcast",      group: "core" },
  { key: "youtube_avod",  label: "YouTube / AVOD / Free Digital", group: "core" },
  { key: "svod",          label: "SVOD",                          group: "core" },
  { key: "tvod_ppv",      label: "TVOD / Pay-Per-View",           group: "core" },
  { key: "fast",          label: "FAST / Free streaming channels", group: "core" },
  // Premium — managed rights-sales (paid plan)
  { key: "dubbing",       label: "Dubbing rights",                group: "premium" },
  { key: "remake",        label: "Remake rights",                 group: "premium" },
  { key: "inflight",      label: "In-flight / Airline rights",    group: "premium" },
  { key: "ship_cruise",   label: "Ship / Cruise / Seaways rights", group: "premium" },
  { key: "hospitality",   label: "Hotel / Hospitality / Non-theatrical", group: "premium" },
  { key: "educational",   label: "Educational / Institutional screening", group: "premium" },
  { key: "intl_tv",       label: "International TV rights",       group: "premium" },
  { key: "clip_license",  label: "Clip / excerpt licensing",      group: "premium" },
  { key: "soundtrack",    label: "Audio / soundtrack exploitation", group: "premium" },
  { key: "merchandising", label: "Ancillary / merchandising",     group: "premium" },
];

export const TERRITORY_CATALOG: ReadonlyArray<{ key: string; label: string }> = [
  { key: "worldwide",     label: "Worldwide" },
  { key: "india",         label: "India" },
  { key: "gulf_me",       label: "Gulf / Middle East" },
  { key: "north_america", label: "North America" },
  { key: "uk_europe",     label: "United Kingdom & Europe" },
  { key: "anz",           label: "Australia / New Zealand" },
  { key: "sea",           label: "South East Asia" },
  { key: "row",           label: "Rest of World" },
];

export const RIGHT_STATUS_LABEL: Record<RightStatus, string> = {
  none: "—",
  available: "Available",
  sold: "Already Sold",
  not_available: "Not Available",
  discuss: "Discuss with StreamVista",
  premium_required: "Premium Service Required",
};

export const TERRITORY_STATUS_LABEL: Record<TerritoryStatus, string> = {
  none: "—",
  available: "Available",
  sold: "Already Sold",
  blocked: "Blocked / Unavailable",
  discuss: "Reserved / Discuss",
};

export const PREMIUM_PLAN_TIERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "tier_25k",  label: "₹25,000 + GST" },
  { value: "tier_50k",  label: "₹50,000 + GST" },
  { value: "tier_100k", label: "₹1,00,000 + GST" },
];
