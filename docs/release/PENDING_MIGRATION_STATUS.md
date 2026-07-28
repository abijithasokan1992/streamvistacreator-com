# Pending Migration Status — Phase 0 / Checkpoint 0

**Scope:** read-only. No migration executed. No file moved between `supabase/migrations/` and `supabase/migrations-pending/`.

## Inventory

- `supabase/migrations/` — 324 tracked files (last entry `20260728042000_4aa9d5d1-30ed-4de0-8754-d3e5c40ebd33.sql`).
- `supabase/migrations-pending/` — 8 SQL files + `README.md`.
- Remote `supabase_migrations.schema_migrations` (project ref `hllgmkfqgeuqlmpcirvn`) — latest entry `20260728042003` (`20260728042000_4aa9d5d1-…`).

## Status matrix — every file in `supabase/migrations-pending/`

Evidence columns are:
- **In pending?** — file exists in `supabase/migrations-pending/`
- **In tracked?** — a file with the same version prefix exists in `supabase/migrations/`
- **In `schema_migrations`?** — remote history contains an entry with that version prefix
- **Runtime evidence** — presence of the object the migration creates
- **Status** — one of `applied-and-tracked`, `applied-but-in-pending (do-not-reapply)`, `pending-still-required`, `superseded`, `duplicate`

| # | File | In pending? | In tracked? | In `schema_migrations`? | Runtime evidence | Status |
|---|---|---|---|---|---|---|
| 1 | `20260717_000000_title_canonical_backfill.sql` | Yes | No | No | `content_titles.canonical_title` column **absent** | **pending-still-required** |
| 2 | `20260717_010000_revenue_statement_import.sql` | Yes | No | No | `public.revenue_imports` table **present**; `public.import_revenue_statement` RPC **absent** | **pending, partially applied — needs investigation** (table shipped by another migration; RPC still missing) |
| 3 | `20260718_000000_dit_ingest_screenshots_bucket.sql` | Yes | No | No | `storage.buckets.id = 'dit-ingest-screenshots'` **present** | **applied-but-in-pending (do-not-reapply)** |
| 4 | `20260727101915_buyer_marketplace_rpc.sql` | Yes | No | Yes (`20260727101920`) | `public.buyer_list_marketplace_titles` RPC **present** | **applied-but-in-pending (do-not-reapply)** |
| 5 | `20260727101916_user_profiles_privileged_guard.sql` | Yes | No | Yes (`20260727101920`, same batch) | function with `user_profiles` + `priv` in name **present** | **applied-but-in-pending (do-not-reapply)** |
| 6 | `20260727120000_admin_set_title_commercial_state.sql` | Yes | No | No | `public.admin_set_title_commercial_state` RPC **absent** | **pending-still-required** |
| 7 | `20260727130000_onboarding_requests_field_lock_trigger.sql` | Yes | No | No | `trg_enforce_onboarding_owner_field_lock` **absent**; `trg_enforce_hard_disk_intakes_admin_notes_lock` **absent** | **pending-still-required** — matches the active scanner finding `hard_disk_intakes_ineffective_admin_notes_check` |
| 8 | `20260728_quarantine_demo_titles.sql` | Yes | No | **No** | 41 rows in `content_titles` carry `metadata->>'quarantined_batch' = 'batch2_2026-07-28'`; classification counts: `pre_production=21, seed=13, internal_test=6, system_test=1` (== the manifest) | **applied-but-in-pending (do-not-reapply)** |

## Special calls the Founder asked me to make explicitly

### `20260728_quarantine_demo_titles.sql`

- Not present in `supabase_migrations.schema_migrations` (checked with `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '20260727'`; only tracked entries are `20260727062847`, `20260727071638`, `20260727072117`, `20260727101920`, `20260728042003`).
- Runtime evidence proves it ran anyway: 41 quarantined rows exist with the exact per-classification counts recorded in the Batch 2 manifest (`pre_production 21 · seed 13 · internal_test 6 · system_test 1`). The `quarantined_batch` string `batch2_2026-07-28` is the exact literal used by this SQL file.
- **Classification per Founder rule:** `applied-but-in-pending (do-not-reapply)`.
- **Guardrail:** the file must remain under `supabase/migrations-pending/` (Supabase runner does not scan that directory). Do not `mv` it into `supabase/migrations/`. Do not open a new migration that re-runs its body.

### `20260727130000_onboarding_requests_field_lock_trigger.sql`

- Not present in `supabase_migrations.schema_migrations`.
- Runtime evidence confirms it has **not** been applied: neither `trg_enforce_onboarding_owner_field_lock` nor `trg_enforce_hard_disk_intakes_admin_notes_lock` exists in `pg_trigger`.
- The active Lovable security scanner finding on `hard_disk_intakes.admin_notes` is consistent with this migration being un-applied — the SQL in this file is the drafted fix.
- **Classification:** `pending-still-required`. Application is a Checkpoint-1 decision, not Phase 0.

## Recent tracked migrations already in `schema_migrations` (last 5)

| Version | Name |
|---|---|
| `20260727062847` | `20260727062845_49057979-…` |
| `20260727071638` | `20260727071636_faa7bea0-…` |
| `20260727072117` | `20260727072115_0c17ab24-…` |
| `20260727101920` | `20260727101915_428d8bdc-…` (this batch shipped items 4 and 5 of the pending list above) |
| `20260728042003` | `20260728042000_4aa9d5d1-…` |

No stray remote entry after `20260728042003`. Nothing points to the quarantine migration; its execution was performed outside the normal migration runner.

## Confirmed / Unconfirmed / Contradicted

- **Confirmed:** file inventory in both directories; last five remote migration versions; presence/absence of every runtime object listed above; the exact 41-row quarantine metadata shape.
- **Unconfirmed:** whether the `revenue_statement_import` RPC was renamed vs never applied — the pending SQL should be diffed against live schema before either dropping or re-issuing it.
- **Contradicted:** none.
