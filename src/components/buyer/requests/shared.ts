// Shared constants, labels, and types for buyer commercial requests.
// Extracted from src/pages/dashboards/Buyer.tsx so multiple sections can reuse
// the same vocabulary without duplicating logic.

export type EnumType = "acquisition" | "licensing" | "screener" | "rights_info" | "distribution";

export type Category =
  | "screener"
  | "rights_availability"
  | "acquisition_interest"
  | "licensing"
  | "distribution_territory"
  | "dubbing_language"
  | "clip_promo"
  | "remake_adaptation"
  | "catalog_access";

export const CATEGORY_LABEL: Record<Category, string> = {
  screener: "Screener",
  rights_availability: "Rights availability",
  acquisition_interest: "Acquisition interest",
  licensing: "Licensing",
  distribution_territory: "Distribution / Territory",
  dubbing_language: "Dubbing / Language rights",
  clip_promo: "Clip / Promo rights",
  remake_adaptation: "Remake / Adaptation",
  catalog_access: "Catalog access",
};

export const CATEGORY_TO_ENUM: Record<Category, EnumType> = {
  screener: "screener",
  rights_availability: "rights_info",
  acquisition_interest: "acquisition",
  licensing: "licensing",
  distribution_territory: "distribution",
  dubbing_language: "licensing",
  clip_promo: "licensing",
  remake_adaptation: "acquisition",
  catalog_access: "rights_info",
};

export const TERRITORIES = ["India", "South Asia", "Middle East", "SE Asia", "Europe", "UK", "North America", "LATAM", "ANZ", "Worldwide"];
export const RIGHTS_CATEGORIES = ["SVOD", "AVOD", "TVOD", "Theatrical", "Broadcast TV", "Airline / Non-theatrical", "Remake / IP", "Clip / Promo"];
export const PLATFORM_TYPES = ["OTT platform", "Broadcaster", "Distributor", "Studio", "Brand", "Festival / Curator", "Other"];
export const EXCLUSIVITY = ["Exclusive", "Non-exclusive", "Open to either"];
export const TERM_BUCKETS = ["< 1 yr", "1–3 yrs", "3–5 yrs", "5+ yrs", "Perpetual"];
export const URGENCIES = ["Standard", "Within 30 days", "Within 7 days", "Critical"];
export const LANGUAGES = ["Malayalam", "Tamil", "Telugu", "Hindi", "Kannada", "English", "Bengali", "Marathi", "Other"];
export const GENRES = ["Drama", "Thriller", "Comedy", "Romance", "Action", "Documentary", "Horror", "Family", "Crime", "Sci-fi"];
export const FORMATS = ["Feature", "Series", "Short", "Documentary", "Reality", "Animation"];

export const STATE_LABEL: Record<string, string> = {
  pending_admin_review: "Submitted — admin review",
  awaiting_creator_review: "Owner / rights review",
  more_info_required: "Clarification needed",
  rejected: "Closed — not available",
  approved_for_negotiation: "Commercial discussion",
  agreement_pending: "Agreement pending",
  delivery_authorized: "Closed — approved",
  closed: "Closed",
};

export const STATE_TONE: Record<string, string> = {
  pending_admin_review: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  awaiting_creator_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  more_info_required: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  approved_for_negotiation: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  agreement_pending: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  delivery_authorized: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  closed: "bg-secondary text-muted-foreground border-border/60",
};

export type RowTerms = {
  category?: Category;
  territory?: string;
  rights_category?: string;
  platform_type?: string;
  exclusivity?: string;
  term_bucket?: string;
  screener_needed?: boolean;
  nda_ready?: boolean;
  urgency?: string;
  languages?: string[];
  genres?: string[];
  formats?: string[];
  notes?: string;
};

export type Row = {
  id: string;
  request_type: EnumType;
  state: string;
  title_query: string | null;
  message: string | null;
  admin_notes: string | null;
  terms: RowTerms | null;
  title_id: string | null;
  created_at: string;
  updated_at: string;
};

export const OPEN_STATES = ["pending_admin_review", "awaiting_creator_review", "more_info_required"];
export const ACTIVE_STATES = ["awaiting_creator_review", "approved_for_negotiation", "agreement_pending"];
export const CLOSED_STATES = ["closed", "rejected", "delivery_authorized"];
