/**
 * productionNumber — single source for Production Number generation and read.
 *
 * UI-only helper. The value is persisted on the existing `projects.crew.title_number`
 * JSONB field; there is no schema change. All Studio surfaces (cards, hero,
 * ingest, activity, media, reports, deliverables) read via `getProductionNumber`
 * so the label and format stay consistent.
 */

const PRODUCTION_NUMBER_PREFIX = "PRD";

/** Generate a unique-ish Production Number: `PRD-YYYYMMDD-XXXX`. */
export function generateProductionNumber(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${PRODUCTION_NUMBER_PREFIX}-${yyyy}${mm}${dd}-${rand}`;
}

/** Read the Production Number from a project row (or its `crew` JSONB). */
export function getProductionNumber(
  source: { crew?: any } | Record<string, any> | null | undefined,
): string | null {
  if (!source) return null;
  const crew = (source as any).crew ?? source;
  const raw = crew?.title_number ?? crew?.production_number;
  return typeof raw === "string" && raw.trim() ? raw : null;
}
