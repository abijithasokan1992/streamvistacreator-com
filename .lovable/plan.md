# Batch 1 — Updated Implementation Proposal (post-investigation)

No code, migration, RPC, bucket, deployment, or data mutation executed. Findings below are from live-DB reads this turn.

---

## 1. Compatibility mechanism — reuse existing structures (no new table)

### Evidence
- `entity_profiles` already models buyer identity (`kind='buyer'`) with `verification_status`, `last_verified_at`, `org_id`, plus buyer-ext table for acquisition metadata. It is the platform's canonical buyer verification surface.
- `legal_acceptances(agreement_type)` already includes the enum value `buyer_request_confidentiality` — the platform's canonical buyer NDA surface.
- `onboarding_requests` schema exists but contains **no buyer rows** and has no `requested_role` column, so it is not currently the buyer onboarding vehicle.
- Live production state for the 5 existing buyer accounts:
  - 0 `entity_profiles` rows
  - 0 `buyer_request_confidentiality` acceptances
  - `is_suspended = false` for all

### Decision
- **Do not introduce `buyer_marketplace_allowlist`.** The existing `entity_profiles` + `legal_acceptances` combination is the reusable, auditable, business-correct mechanism.
- Bringing existing buyers online is an **operational onboarding step**, not a schema workaround: admins (or the buyer themselves through the existing entity-profile flow) create an `entity_profiles` row with `kind='buyer'`, admins set `verification_status='verified'` after review, and the buyer records `buyer_request_confidentiality` acceptance through the existing legal-gate surface.
- Until those rows exist, the RPC returns an empty set for those users — this is the correct fail-closed outcome, not an outage: no buyer has yet completed verification.
- No new table. No allow-list. No permissive fallback.

---

## 2. Actual `verification_status` values in production

```
verification_status | count
--------------------+------
unverified          |     9
```

- Only one distinct value exists today: `unverified`.
- No verified buyers exist. There is no operational `verified` string in use.
- **The RPC's accepted set will therefore be exactly `{'verified'}`** — the canonical string admins will write when they approve a buyer entity. This is a policy decision, not an assumption about existing data; it defines the value that admin tooling must write going forward. Any additional value (e.g. `pending_review`) will not be accepted until it is stored in production and reviewed.
- The RPC will reference this set as a single hard-coded array of strings inside the function body, with a comment naming the source of truth (`entity_profiles.verification_status = 'verified'`), so future changes are one-file edits.

---

## 3. Legacy UI field derivation (before falling back to null)

Consumer: `useMarketplaceCatalog.ts` currently exposes `title, subtitle, blurb, poster_url, content_type, year, partner, starts_at, ends_at, updated_at`. For each field, sources checked in the live schema:

| legacy field | derivation | source of truth | fallback |
|---|---|---|---|
| `title` | direct | `content_titles.title` | — |
| `subtitle` | none — no equivalent column exists | — | `null` |
| `blurb` | derive from `title_commercial_profiles.buyer_facing_summary` (buyer-safe), else truncated `content_titles.synopsis` (first 240 chars) | confirmed columns | `null` |
| `poster_url` | subquery `title_assets` where `category='poster' AND is_primary=true`, resolved through `upload_sessions` when a resolvable URL/path field exists. Requires a follow-up read of `upload_sessions` columns at build time to confirm the URL surface; if none is exposable to buyers, this field is `null` for now. | `title_assets` + `upload_sessions` | `null` |
| `content_type` | derive from `content_titles.kind` (`film`/`series`/`season`/`episode`/`collection_entry`) | `title_kind` enum confirmed | — |
| `year` | derive from `content_titles.metadata->>'year'` **if key present** — `metadata` is jsonb and currently empty for RFD/approved rows (0 rows). Hook returns `Number(metadata.year) \|\| null`. | `content_titles.metadata` | `null` |
| `partner` | no reliable source — `content_titles` has no FK to `productions`, and `production_banner` enum is Crayons/Abhijith only (not a general partner registry) | — | `null` |
| `starts_at` / `ends_at` | were editorial run windows on `featured_films`; no marketplace-equivalent columns exist | — | `null` |
| `updated_at` | direct | `content_titles.updated_at` | — |

Result: `subtitle`, `partner`, `starts_at`, `ends_at` fall back to `null` because repository evidence confirms no equivalent source. All others derive from confirmed columns.

---

## 4. Final RPC contract

`public.buyer_list_marketplace_titles()` — SECURITY DEFINER, STABLE, `SET search_path=public`, `REVOKE FROM PUBLIC; GRANT EXECUTE TO authenticated;`

**Caller predicate (fail-closed, no permissive fallback):**
```sql
auth.uid() IS NOT NULL
AND public.has_role(auth.uid(), 'buyer')
AND EXISTS (SELECT 1 FROM public.user_profiles up
            WHERE up.user_id = auth.uid() AND up.is_suspended = false)
AND EXISTS (SELECT 1 FROM public.entity_profiles ep
            LEFT JOIN public.organizations o ON o.id = ep.org_id
            WHERE ep.user_id = auth.uid()
              AND ep.kind = 'buyer'
              AND ep.verification_status = 'verified'
              AND (o.id IS NULL OR o.status <> 'suspended'))
AND EXISTS (SELECT 1 FROM public.legal_acceptances la
            WHERE la.user_id = auth.uid()
              AND la.agreement_type = 'buyer_request_confidentiality')
```

**Eligibility predicate on titles:**
```sql
ct.status = 'ready_for_distribution'
AND tcp.published_to_buyers = true
AND tcp.commercial_status IN ('screening_only','licensing_open','acquisition_open','invite_only')
AND (
  tcp.available_for_screeners
  OR tcp.available_for_nonexclusive_license
  OR tcp.available_for_exclusive_license
  OR tcp.available_for_acquisition
  OR tcp.available_for_distribution_partnership
)
```

**Return columns (allow-listed):**
`id, title, synopsis (raw text — hook truncates), language, genre, duration_minutes, kind, metadata_year (integer, from metadata->>'year'), commercial_status, screener_available, licensing_nonexclusive_available, licensing_exclusive_available, acquisition_available, distribution_partnership_available, buyer_facing_summary, poster_url (nullable), updated_at`.

Excluded confidential columns: `owner_user_id, workspace_id, notes, chain_of_title_notes, rights_status_summary, legal_clearance_summary, delivery_readiness_summary, qc_status, legal_clearance, approved_by, published_by, all internal timestamps other than updated_at`.

---

## 5. Frontend change

`src/components/buyer/marketplace/useMarketplaceCatalog.ts`:
- Swap `.from('featured_films')` for `supabase.rpc('buyer_list_marketplace_titles')`.
- Map RPC row → hook row (preserves the `MarketplaceTitle` shape):
  - `subtitle` ← `null`
  - `blurb` ← `buyer_facing_summary ?? synopsis?.slice(0, 240) ?? null`
  - `poster_url` ← from RPC (nullable)
  - `content_type` ← `kind`
  - `year` ← `metadata_year`
  - `partner`, `starts_at`, `ends_at` ← `null` (documented above)

No `FindContentSection.tsx` change required.

---

## 6. Files to create/modify

- `supabase/migrations/<ts>_buyer_marketplace_rpc.sql` — RPC + grants only. **No new table.**
- `src/components/buyer/marketplace/useMarketplaceCatalog.ts` — data source swap + normalization.
- `tests/security/buyer_marketplace_rpc.sql` — role/verification/NDA/suspension gates + eligibility filter + confidential-column exclusion.
- `src/test/smoke/buyer-marketplace-catalog.test.ts` — hook renders / empty / error paths.

---

## 7. Confidentiality verification

- RPC returns strictly the allow-listed columns above. No creator PII, no admin notes, no rights/legal internals, no owner_user_id, no workspace_id, no cost data.
- Anonymous callers cannot invoke (grant scoped to `authenticated`).
- Non-buyer, unverified, un-NDA'd, or suspended callers receive an empty set — no enumeration, no error leak.

---

## 8. Rollback (non-destructive)

- Revert `useMarketplaceCatalog.ts` (single-file revert).
- `DROP FUNCTION public.buyer_list_marketplace_titles();` — safe: read-only function with no dependents outside the reverted hook, no persisted state.
- No buckets, no allow-list table, no data mutation — nothing to preserve for audit.

---

## 9. Remaining Batch 1 risks / follow-ups

- The 5 existing buyer accounts see an empty marketplace until an admin creates their `entity_profiles` row, sets `verification_status='verified'`, and they accept `buyer_request_confidentiality`. This is the correct fail-closed behavior; the operational onboarding UI for that flow is out of Batch 1 scope and belongs to the buyer-onboarding batch.
- `poster_url` resolution depends on `upload_sessions` exposing a buyer-safe URL/path. If build-time read shows no such field is safe to expose, `poster_url` stays `null` for Batch 1 and is completed in the asset-URL batch.
- No approved verified-status string other than `'verified'` will be recognized until it appears in production and is added to the RPC's accepted set.

---

Awaiting build-mode approval to implement Batch 1 exactly as scoped above.
