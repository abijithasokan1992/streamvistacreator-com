/**
 * Commercial model taxonomy — Phase D2A.
 *
 * These are commercial payment/monetisation models, NOT rights categories.
 * Rights categories (linear / non-linear / ancillary) are stored separately
 * on the deal/contract and MUST NOT be conflated with payment rails.
 */

export const COMMERCIAL_MODELS = [
  "svod", // subscription video-on-demand
  "tvod", // transactional / rental / EST
  "avod", // ad-supported
  "mg", // minimum guarantee (advance recoupable)
  "fixed_license_fee", // flat license fee, non-recoupable
  "revenue_share", // pure revenue share
  "per_film", // one-off per-title fee
  "bulk_title", // package of many titles
  "bulk_hours", // hours-based catalogue license
] as const;

export type CommercialModel = (typeof COMMERCIAL_MODELS)[number];

export const RIGHTS_CATEGORIES = ["linear", "non_linear", "ancillary"] as const;
export type RightsCategory = (typeof RIGHTS_CATEGORIES)[number];

export function isCommercialModel(v: unknown): v is CommercialModel {
  return typeof v === "string" && (COMMERCIAL_MODELS as readonly string[]).includes(v);
}

export function isRightsCategory(v: unknown): v is RightsCategory {
  return typeof v === "string" && (RIGHTS_CATEGORIES as readonly string[]).includes(v);
}

/**
 * Whether a model implies a revenue-share rate must be present. MG has a
 * revenue-share tail after recoupment; fixed license fee never does.
 */
export function modelRequiresShareRate(m: CommercialModel): boolean {
  return m === "svod" || m === "tvod" || m === "avod" || m === "revenue_share" || m === "mg";
}

export function humanModelLabel(m: CommercialModel): string {
  switch (m) {
    case "svod": return "Subscription (SVOD)";
    case "tvod": return "Transactional (TVOD)";
    case "avod": return "Ad-supported (AVOD)";
    case "mg": return "Minimum Guarantee";
    case "fixed_license_fee": return "Fixed License Fee";
    case "revenue_share": return "Revenue Share";
    case "per_film": return "Per Film";
    case "bulk_title": return "Bulk Titles";
    case "bulk_hours": return "Bulk Hours";
  }
}
