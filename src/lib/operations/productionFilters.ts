/**
 * Shared production-record filter for operational counters.
 *
 * Media Office and Mission Control MUST both apply this filter when
 * counting titles so their totals match and neither surface ever
 * reflects seed / demo / synthetic / internal-test records.
 *
 * Nothing in here mutates data. The filter is intentionally
 * conservative:
 *   - genuine creator drafts stay visible even if unpaid / empty
 *   - only records with a definite demo signal are excluded
 *
 * Signals used (all reviewable in
 * /mnt/documents/media_office_classification.csv):
 *   1. Orphan owner (auth user was deleted or never existed).
 *   2. Owner belongs to an internal / bridge account.
 *   3. Explicit `metadata.is_test = true` or `metadata.data_classification`
 *      in {'demo','test','seed','internal_test'} — populated by the
 *      quarantine migration in `supabase/migrations-pending/`.
 *
 * `title`-based heuristics ("TEST 1", "Review Sample") are NOT applied
 * automatically; a genuine title can legitimately contain the word
 * "test". Those rows are marked in the manifest and require an
 * operator to set `metadata.is_test = true` first.
 */

/** Known non-production owner accounts (internal bridge / QA users). */
export const NON_PRODUCTION_OWNER_IDS: readonly string[] = [
  // Orphan seed owner — the entire 2026-06-19 'Kolumittayi' burst.
  "0ba667ef-e1e4-49fd-a413-587b65c376e5",
  // Internal review account (streamvistareview@gmail.com).
  "49e14384-aca6-4f4a-8810-1e53035da294",
  // Internal support bridge (support-bridge@crayonspictures.com).
  "48d8dc2f-62b0-49c5-841a-dae1aee9f1be",
];

/** Email domains / addresses that mark an internal, non-production owner. */
export const NON_PRODUCTION_OWNER_EMAILS: readonly string[] = [
  "streamvistareview@gmail.com",
  "support-bridge@crayonspictures.com",
];

export type OperationalTitleRow = {
  id: string;
  owner_user_id: string | null;
  metadata?: Record<string, unknown> | null;
  // `owner_email` is optional — only present when the caller joined on
  // profiles/auth. When absent we fall back to id + metadata checks.
  owner_email?: string | null;
};

/** Returns true when a row should be counted on operational dashboards. */
export function isProductionTitle(row: OperationalTitleRow): boolean {
  if (row.owner_user_id == null) return false;
  if (NON_PRODUCTION_OWNER_IDS.includes(row.owner_user_id)) return false;
  const email = (row.owner_email ?? "").toLowerCase();
  if (email && NON_PRODUCTION_OWNER_EMAILS.includes(email)) return false;

  const meta = row.metadata ?? {};
  if ((meta as any).is_test === true) return false;
  const classification = String((meta as any).data_classification ?? "").toLowerCase();
  if (NON_PRODUCTION_CLASSIFICATIONS.includes(classification as any)) return false;

  return true;
}

/**
 * Classifications produced by the Batch 2 quarantine migration
 * (see supabase/migrations-pending/20260728_quarantine_demo_titles.sql).
 * Any row whose `metadata.data_classification` matches is excluded from
 * operational counters and only surfaced in the Demo & Test review view.
 */
export const NON_PRODUCTION_CLASSIFICATIONS = [
  "demo",
  "test",
  "seed",
  "internal_test",
  "system_test",
  "pre_production",
  "archived",
] as const;

/**
 * PostgREST filter fragment appended to `content_titles` counter queries.
 * Excludes the known non-production owner ids so the DB does the work
 * whenever possible. The metadata-level filter is applied in-memory in
 * `isProductionTitle` because PostgREST does not support `->>` filters
 * on `head:true` counts uniformly across all deployments.
 */
export const PRODUCTION_TITLE_OWNER_EXCLUSION = NON_PRODUCTION_OWNER_IDS
  .map((id) => `owner_user_id.neq.${id}`)
  .join(",");

/**
 * Apply the shared production filter to any PostgREST query builder that
 * targets `content_titles`. Excludes:
 *   - known non-production owner ids (orphans, internal bridges)
 *   - rows tagged `metadata.is_test = true` by the quarantine migration
 *
 * Callers that also need to exclude `data_classification` values beyond
 * `is_test = true` can post-filter with `isProductionTitle` in-memory;
 * every quarantined row has `is_test = true` so the DB filter alone is
 * sufficient for the counters wired in Batch 2.
 *
 * Usage:
 *   const q = supabase.from("content_titles").select("id", { count: "exact", head: true });
 *   applyProductionFilterToTitlesQuery(q).eq("status", "draft")
 */
export function applyProductionFilterToTitlesQuery<Q extends { not: (col: string, op: string, val: unknown) => Q; filter?: unknown }>(
  query: Q,
): Q {
  let q: any = query;
  for (const ownerId of NON_PRODUCTION_OWNER_IDS) {
    q = q.neq("owner_user_id", ownerId);
  }
  // Exclude rows where metadata.is_test === true. Coerced to text via ->>.
  q = q.not("metadata->>is_test", "eq", "true");
  return q as Q;
}

/**
 * Inverse of `applyProductionFilterToTitlesQuery`: narrows a query to
 * ONLY the quarantined rows so the Demo & Test review view can list
 * them for founder inspection.
 */
export function applyQuarantineOnlyFilterToTitlesQuery<Q extends { eq: (col: string, val: unknown) => Q }>(
  query: Q,
): Q {
  return (query as any).eq("metadata->>is_test", "true") as Q;
}

/** Labels used by counter chips — kept here so both dashboards stay in sync. */
export const OPERATIONAL_COUNTER_LABELS = {
  awaitingQc: "Waiting for Content Quality Review",
  awaitingLegal: "Waiting for Rights & Legal Review",
  drafts: "Unfinished Submissions",
  submitted: "Newly Submitted",
  approved: "Approved, Awaiting Release",
  published: "Released Content",
} as const;
