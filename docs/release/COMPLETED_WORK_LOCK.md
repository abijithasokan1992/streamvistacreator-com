# StreamVista Completed Work Lock

Purpose: prevent verified work from being repeatedly rewritten, re-migrated, or reopened without new evidence.

## Operating rule

A completed item is **LOCKED** when repository evidence shows the implementation landed and the required verification for that scope passed. Locked work must be preserved and reused.

Do not reopen, rewrite, replace, cherry-pick over, or re-run a locked item merely because an older PR, plan, scanner report, or historical defect mentions it.

A locked item may be reopened only when at least one of these is present:

1. A current runtime reproduction on the present `main`/production-readiness branch.
2. A failing regression/security test tied to that implementation.
3. A current CI failure caused by that implementation.
4. A live schema/runtime contradiction proving the recorded result is stale.
5. An explicit Founder instruction to redesign or replace the completed work.

When reopened, record the new evidence first and make the smallest compatible repair. Do not rebuild the feature from scratch unless the existing implementation is proven unusable.

## Locked completed work

### Batch 2 — quarantine data classification

Status: **LOCKED — DO NOT REAPPLY**

Evidence:
- 41 `content_titles` records were tagged with `quarantined_batch = batch2_2026-07-28`.
- Classification split: 13 `seed`, 6 `internal_test`, 1 `system_test`, 21 `pre_production`.
- No row deletion was part of the operation.
- Historical runtime evidence is recorded in `docs/release/PENDING_MIGRATION_STATUS.md`.

Rule:
- `supabase/migrations-pending/20260728_quarantine_demo_titles.sql` must not be moved into the normal migration runner or re-executed.
- Future production filtering must consume the quarantine metadata instead of reclassifying the same 41 rows.

### Batch 2 / 2b — production filtering

Status: **LOCKED unless a current regression is reproduced**

Evidence commits:
- `cc8d503a66e637f54a1531ea5d2acef36e4c7811` — Batch 2 wiring.
- `8547f541a1e3abe73613abae73d30924fe711fcf` — Batch 2b production-filter wiring.

Preserve:
- `src/lib/operations/productionFilters.ts` as the shared production/non-production definition.
- Existing operational surfaces should reuse the shared helpers rather than create independent demo/test rules.

### Batch A regression guardrails

Status: **IMPLEMENTATION LOCKED; runtime-only gaps remain open**

Evidence commit:
- `3d5dd808c6552b9a890fea84e08e2926e15184b7`.

Preserve:
- QC fast-pass state gating in `TitleReviewPanel.tsx`.
- Creator revenue title/workspace filtering contract already covered by Batch A tests.
- Submit Content schema-compatible `contact_messages` payload contract already covered by Batch A tests.

Do not rewrite these paths merely to address the historical reports. Only add the missing runtime proof or make a repair when a current reproduction demonstrates a real regression.

### Onboarding / hard-disk admin-field lock

Status: **SOURCE-APPLIED / LOCKED AGAINST DUPLICATE MIGRATION**

Current tracked migration:
- `supabase/migrations/20260728054727_d60fa5e6-df66-4794-984d-39a024fe5529.sql`

Historical pending artifact:
- `supabase/migrations-pending/APPLIED_20260728_onboarding_requests_field_lock_trigger.sql.applied`

Rule:
- Never re-run the historical pending SQL as a second migration.
- Verify live trigger state when database access is available; if live state is missing, repair migration history explicitly rather than duplicating the trigger blindly.

## Work that is NOT locked as complete

These remain verification/fix work and must not be treated as finished without current evidence:

- Submit Content full business-contract runtime proof.
- QC → Legal authenticated end-to-end transition and audit proof.
- Creator Revenue two-workspace runtime isolation proof.
- Revenue import mapping end-to-end proof.
- DIT authenticated upload + log-save proof.
- Email retry sweeper runtime 200/audit behavior.
- Firecrawl structured-error visibility.
- Firecrawl custom-search failure visibility.
- Email retry banner runtime reason surfacing.
- Accessibility CI current failure.
- Security-scan CI current failure.

## PR reuse rule

- PR #91 is reference material only; do not merge wholesale into the production-readiness branch.
- PR #74 is a targeted-fix reference; reuse only the still-missing hunks after comparison with current `main`.
- Duplicate CodeQL PRs must not be stacked or merged together; retain one canonical approach only.

## Definition of no-rework

Before touching a previously completed area, answer all three:

1. What current evidence proves it is broken now?
2. What exact existing implementation can be preserved?
3. What is the smallest change that restores correctness?

If question 1 has no evidence, do not rework the completed area.
