# Checkpoint 0 — Evidence collected (build mode needed to persist docs)

Phase 0 ran under the read-only scope you approved. All git and database evidence is now in hand. The only remaining step is writing the four documentation files, which requires build mode — plan mode blocked those writes.

## What Phase 0 confirmed (read-only, no mutations)

### 1. Git and working-tree state
- Current branch: `edit/edt-fb74646d-34bf-4b7f-8792-22c81c5a5c9d` @ `3d5dd808c6552b9a890fea84e08e2926e15184b7`
- `main` HEAD: `3d5dd808…` — identical SHA. 0 commits ahead, 0 behind.
- Working tree: **clean** (`git status --porcelain` returned no lines).
- Batch commits (all already on `main`, ancestors of HEAD):
  - Batch A regression tests — `3d5dd808`
  - Batch 2b filter wiring — `8547f541`
  - Batch 2 wiring — `cc8d503a`
  - Batch 2 quarantine applied — `d1e2167f`
  - Batch 2 migration SQL revamp — `e5a03325`
  - Batch 2 manifest reprint — `1e718cf9`
- **No batch work is trapped in an unmerged branch or in the working tree.** Creating `chatgpt/production-readiness` now from `3d5dd808` would preserve everything without cherry-picks.

### 2. GitHub / PR surface — cannot be authoritatively enumerated
- `origin` points at Lovable-managed git storage, not GitHub.
- No GitHub connector exists in the workspace (checked via `standard_connectors--list_connections`).
- Unauthenticated `GET api.github.com/repos/abijithasokan1992/streamvistacreator-com/pulls` returned **HTTP 404**.
- Visible remote branches other than `main` / `edit/edt-*`: one Razorpay feature branch (likely already merged), three Copilot branches, three `lovable-backup-main-*` snapshots. All treated **do-not-merge by default** until PR metadata can be verified.
- **Recommendation:** authorize the GitHub connector before Phase 1 if PR-based review is required.

### 3. Migration inventory — 8 files in `supabase/migrations-pending/`
Latest remote `schema_migrations` version: `20260728042003`. Per-file status:

| File | Applied remotely? | Status |
|---|---|---|
| `20260717_000000_title_canonical_backfill.sql` | No (`canonical_title` column absent) | **pending-still-required** |
| `20260717_010000_revenue_statement_import.sql` | Partial (`revenue_imports` table present, `import_revenue_statement` RPC **absent**) | **pending, needs investigation** |
| `20260718_000000_dit_ingest_screenshots_bucket.sql` | Yes (bucket present) | **applied-but-in-pending (do-not-reapply)** |
| `20260727101915_buyer_marketplace_rpc.sql` | Yes (RPC present; `schema_migrations` `20260727101920`) | **applied-but-in-pending (do-not-reapply)** |
| `20260727101916_user_profiles_privileged_guard.sql` | Yes (guard function present) | **applied-but-in-pending (do-not-reapply)** |
| `20260727120000_admin_set_title_commercial_state.sql` | No (RPC absent) | **pending-still-required** |
| `20260727130000_onboarding_requests_field_lock_trigger.sql` | No (neither trigger installed) | **pending-still-required** — matches the active `hard_disk_intakes_ineffective_admin_notes_check` scanner finding |
| `20260728_quarantine_demo_titles.sql` | **Not in `schema_migrations`**, but 41 rows carry `metadata->>'quarantined_batch' = 'batch2_2026-07-28'` with the exact per-class counts from the Batch 2 manifest (`pre_production 21 · seed 13 · internal_test 6 · system_test 1`) | **applied-but-in-pending (do-not-reapply)** — must stay in `migrations-pending/` |

### 4. Defect baseline — nothing marked closed
- **Active scanner:** `hard_disk_intakes_ineffective_admin_notes_check` — trigger drafted, un-applied, awaiting Checkpoint-1 approval.
- **Nine defects:**
  1. Submit Content — source-fixed, runtime 201 confirmed once; business-contract runtime **pending**.
  2. QC → Legal — source-fixed (Batch A); end-to-end **blocked, no eligible title**.
  3. Creator Revenue workspace scoping — source appears scoped; two-workspace isolation proof **pending**.
  4. Revenue import mapping — **open** (RPC absent from live schema).
  5. DIT bucket / log save — bucket now present; log-write path **unverified**.
  6. Email retry HTTP 500 — last fix landed; runtime **unverified**.
  7. Firecrawl structured-error visibility — **open**; connection not linked to project.
  8. Firecrawl custom-search error visibility — **open**.
  9. Email retry banner reason surfacing — **open**.

### 5. Documentation write status
The four Phase-0 documents were fully drafted this turn but blocked by plan mode:
- `docs/release/CURRENT_WORK_PRESERVATION.md`
- `docs/release/PR_CONSOLIDATION.md`
- `docs/release/PENDING_MIGRATION_STATUS.md`
- `docs/release/DEFECT_BASELINE.md`

Full drafts are held in this turn's context and will be persisted verbatim the moment build mode is granted. **No file has been written** — the working tree remains clean.

## Recommended consolidation sequence (for Checkpoint-0 review)

1. **Approve build mode** so the four docs are persisted to the current edit branch (no commit, no push).
2. Do **not** create `chatgpt/production-readiness` yet — `main` already contains every batch commit; the new branch is only useful once Phase 1 has approved artefacts to stack onto it.
3. Authorize the **GitHub connector** for `abijithasokan1992/streamvistacreator-com` before Phase 1, so PR/CI status becomes authoritative.
4. Keep `20260728_quarantine_demo_titles.sql` locked inside `migrations-pending/`. Never move it into `migrations/`. Never open a re-run migration.
5. Phase 1 begins only after you explicitly approve Checkpoint 0.

## What I need from you

Please **switch to build mode** and approve Checkpoint 0. That single approval covers only the write of the four documentation files listed above — no branch operations, no migrations, no PR mutation, no data change.
