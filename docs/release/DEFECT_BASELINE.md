# Defect Baseline — Phase 0 / Checkpoint 0

**Scope:** read-only status per defect. No fix executed in this phase. Nothing marked closed.

## Legend

- **Source-fixed** — code change is on `main` but end-to-end runtime not yet re-verified in this Phase.
- **Runtime-pending** — needs authenticated Playwright / real payment / real webhook / real workspace to confirm.
- **Open** — no source fix landed yet, or last fix failed to resolve.

## Active security-scanner finding (tracked separately from the nine defects)

| ID | Table | Status | Evidence |
|---|---|---|---|
| `hard_disk_intakes_ineffective_admin_notes_check` (MISSING_RLS_PROTECTION, `warn`) | `hard_disk_intakes` | **Open — drafted fix pending approval** | `pg_trigger` shows `trg_enforce_hard_disk_intakes_admin_notes_lock` is not installed. Drafted SQL lives in `supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql` (see `PENDING_MIGRATION_STATUS.md`, row 7). Application is a Checkpoint-1 decision. |

## The nine defects

| # | Defect | Latest status | Source evidence on `main` | Runtime evidence needed to close |
|---|---|---|---|---|
| 1 | Submit Content always fails | **Source-fixed, runtime-pending** — earlier Batch A reproduction returned HTTP 201 and persisted rows for `batcha-repro@example.com`; the original "always fails" report was **not reproduced** in a clean session. | `src/pages/SubmitContent.tsx` (Batch A) | Independent authenticated end-to-end submission that also confirms the *business contract* (owner attribution, downstream notification, no silent fallback email or user_id). Not closed. |
| 2 | Pass QC → Legal always fails | **Source-fixed, runtime-pending** — illegal-state button gating landed in commit `3d5dd808` (Batch A regression tests). | `src/components/admin/TitleReviewPanel.tsx`, `src/test/smoke/batch-a-repairs.test.ts` | End-to-end transition against a live eligible title. **Blocked by test data** — no title currently exists in a QC-passable state (needs one row seeded into `submitted`/`qc_review` to prove RPC + audit write succeed atomically and the title leaves the QC queue). Not closed. |
| 3 | Creator Revenue tab not workspace-scoped | **Source-fixed, runtime-pending** — `src/components/creator/sections/Statements.tsx` already derives `titleIds` from `user.id` + active workspace and passes them into `CreatorRevenueSummary.tsx`'s `.in("title_id", …)` filter. | `src/components/creator/sections/Statements.tsx`, `src/components/creator/CreatorRevenueSummary.tsx` | Two-workspace authenticated isolation proof: switch workspace, confirm revenue rows change, confirm direct client query cannot bypass the filter. Not closed. |
| 4 | Revenue import mapping never links rows to titles | **Open** | Import UI exists (`src/components/admin/revenue/RevenueStatementImport.tsx`) but the server RPC `public.import_revenue_statement` is **absent** (see `PENDING_MIGRATION_STATUS.md`, row 2). The pending migration `20260717_010000_revenue_statement_import.sql` is partially applied. | Restore or replace the RPC, re-import a real statement, confirm `revenue_lines.title_id` populates. |
| 5 | DIT bucket / log save fails | **Open — pre-req applied, path unverified** | `storage.buckets.id='dit-ingest-screenshots'` is **present**, so the earlier "bucket missing" root cause is closed. Whether the log-write path itself succeeds under authenticated session is unverified this phase. | Real DIT upload + log write against an authenticated studio session; capture write to `dit_ingest_logs` and object into the bucket. |
| 6 | Email retry sweeper returns HTTP 500 | **Open — last fix landed, runtime unverified** | `supabase/functions/retry-failed-emails/index.ts` was refactored to decouple audit failures from sweep failures. | Invoke the function while there is at least one `failed`/`dlq` row and confirm 200 + a redacted error record instead of a 500. |
| 7 | Firecrawl structured-error visibility | **Open** | No source change identified this phase. Firecrawl connection is present but **not linked** to this project (`linked to project: no` in the connector list). | Trigger a structured Firecrawl error against the intelligence surface and confirm the UI surfaces the error envelope, not a silent "no results". |
| 8 | Firecrawl custom-search error visibility | **Open** | Same as #7 — no source change. | Same evidence bar as #7. |
| 9 | Email retry banner reason surfacing | **Open** | Banner component exists in `src/lib/email/retryBanner.ts`; the reason wiring for last-failure surfacing has not been touched on `main`. | Trigger a sweep with a real permanent-bounce and confirm the banner names the reason (not a generic "failed"). |

## Rules acknowledged

- No defect above is marked *closed* in this document.
- Source fixes that pre-date runtime verification stay at **source-fixed, runtime-pending** until the specified evidence is produced.
- Runtime verification must happen against the authenticated preview, not a mock.

## Confirmed / Unconfirmed / Contradicted

- **Confirmed:** current on-`main` code for defects 1–3 (Batch A wiring), storage bucket presence for defect 5, absence of `import_revenue_statement` RPC for defect 4, Firecrawl connection state for defects 7/8.
- **Unconfirmed:** every runtime pass/fail listed as "needed to close" above.
- **Contradicted:** the original *"Submit Content always fails"* report — a clean-session reproduction returned 201 with a persisted row. Kept **Open (source-fixed, runtime-pending)** rather than closed, because the reporter's exact context may still produce a failure.
