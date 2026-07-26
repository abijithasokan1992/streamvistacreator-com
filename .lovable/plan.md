# PR-B Recovery Audit — Read-Only

No files edited. No migrations run. No DB queries against production. All findings from repository inspection only.

---

## 1. Migration file location

**Confirmed present** at:

```
supabase/migrations-pending/20260717_000000_title_canonical_backfill.sql
```

- 325 lines, sha256 `e21e46ac15c60c28f341e2571a3b341b8219f3e4de0dfddd9f238ef138d3f574`.
- No renamed or duplicate copy elsewhere in `supabase/migrations/` (grep for "canonical" returns nothing under the executed migrations dir).
- Sibling pending files: `20260717_010000_revenue_statement_import.sql`, `20260718_000000_dit_ingest_screenshots_bucket.sql`.
- Guard test present: `src/test/smoke/title-canonical-backfill-sql.test.ts` (asserts every hardening property below).

## 2. Provenance

Git history is not available in this sandbox (state-changing git ops are forbidden), so I cannot cite a commit hash. What I *can* confirm from the working tree: the file matches the hardened spec from the earlier "Harden ONLY the pending migration" turn — same header comment block, same CTE guards, same RLS policy names (`privileged roles view conflicts`, `privileged roles resolve conflicts`). No drift vs. what was last agreed.

## 3. Hardening checklist vs. current file

| Property | Present | Evidence |
|---|---|---|
| `client_draft_id uuid` column | ✅ | line 85–86 |
| Owner-scoped partial unique index | ✅ | line 88–90, `WHERE client_draft_id IS NOT NULL` |
| `jsonb_typeof(...) = 'array'` guards on `metadata->'genres'` | ✅ | lines 183, 242, 292 (read + backfill + metadata write) |
| Bounded runtime parse `^[0-9]{1,5}$` + `BETWEEN 1 AND 14400` | ✅ | lines 207, 261, 306–314 |
| RLS enabled on `title_backfill_conflicts` | ✅ | line 113 |
| SELECT policy covers admin / super_admin / platform_owner / founder | ✅ | lines 122–131 |
| UPDATE policy with USING + WITH CHECK for all four roles | ✅ | lines 134–149 |
| GRANTs: `SELECT, UPDATE` to authenticated; `ALL` to service_role; no INSERT/DELETE to authenticated | ✅ | lines 110–111 |
| Preflight `SELECT count(*)` present as comments only | ✅ | lines 48–79 |
| Single `BEGIN` / `COMMIT` | ✅ | lines 82, 317 |
| No `DELETE` / `MERGE` / `TRUNCATE` / `DROP TABLE content_titles` | ✅ | verified via test file |
| Idempotent (IF NOT EXISTS + ON CONFLICT DO NOTHING) | ✅ | lines 86, 88, 97, 161, 172, 196, 223 |

**Verdict:** the migration is promotion-ready as far as text is concerned. It is intentionally still in `migrations-pending/` (per that dir's README) and will not be auto-picked by the runner.

## 4. `SECURITY DEFINER` inventory (repo-only)

- 289 `SECURITY DEFINER` occurrences across 134 migration files.
- Approx **32 unique function names** (many are `CREATE OR REPLACE` re-issued across migrations, which inflates the raw count).
- Additionally referenced from Edge Functions: `supabase/functions/topup-sweep/index.ts`, `supabase/functions/infra-health/index.ts`.
- Frontend `supabase.rpc(...)` call sites (33 unique names) confirmed callers include:
  `has_role`, `set_initial_role`, `grant_creator_role`, `revoke_creator_role`,
  `admin_review_queue`, `admin_billing_orders_list`, `admin_billing_order_detail`,
  `admin_mark_order_paid`, `admin_pending_manual_reviews`, `admin_review_manual_payment`,
  `admin_review_onboarding_request`, `admin_set_title_status`, `admin_title_history`,
  `transition_title_status`, `submit_manual_payment_proof`, `create_manual_vault_order`,
  `studio_vault_upsert_product`, `compute_royalty_run`, `claim_legacy_films`,
  `attach_referral`, `accept_legal_agreement`, `log_onboarding_request_view`,
  `founder_vault_log`, `get_workspace_entitlement_snapshot`, `mfi_seats_taken`,
  `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`,
  `pgmq_read_dlq`, `pgmq_delete_dlq`, `record_payment_trace_event`,
  `sweep_abandoned_topups`.

**Assumption (not verified):** each of these functions is `SECURITY DEFINER` in the DB. The repo shows many of them defined that way, but a live `pg_proc` scan is required to confirm the final live definition (some have been `CREATE OR REPLACE`d multiple times).

**Blocker:** without an authoritative live snapshot of `pg_proc.prosecdef` plus current `has_function_privilege(...)` per role, a blanket `REVOKE EXECUTE ... FROM PUBLIC` risks breaking a caller. The 173→225 count discrepancy across earlier audits is unresolved for the same reason.

## 5. Proposed PR-B scope & files

Two clearly separated PRs — do **not** merge into one:

### PR-B1 — Promote hardened backfill (low risk, well-tested)
```
supabase/migrations-pending/20260717_000000_title_canonical_backfill.sql
  → supabase/migrations/20260717_000000_title_canonical_backfill.sql   (git mv)
```
- No other files change.
- Existing guard test (`title-canonical-backfill-sql.test.ts`) already asserts the hardening; it will continue to pass because it reads the file by its new path only if we update the `SQL_PATH` constant. **Action item:** flip that one path string in the same PR.
- Manual preflight: run the 5 commented `SELECT count(*)` queries against production and record results in the PR description before merge.

### PR-B2 — `SECURITY DEFINER` least-privilege pass (needs live pg_proc data first)
Cannot be authored today without a live inventory. Proposed workflow:

1. Read-only RPC (already exists in code path): `mcp_get_security_advisors` — snapshot `pg_proc.prosecdef` + current `EXECUTE` grants.
2. For each function, classify by caller:
   - **Frontend-callable (authenticated only):** GRANT EXECUTE TO authenticated; REVOKE FROM PUBLIC, anon.
   - **Edge-function-only:** REVOKE FROM PUBLIC, authenticated, anon; keep service_role (implicit).
   - **Trigger-only (never RPC'd):** REVOKE FROM PUBLIC, authenticated, anon.
3. Ship as one migration file with one `REVOKE` + targeted `GRANT` block per function.

### Least-privilege matrix (proposal — needs live confirmation before writing SQL)

| Function bucket | Example fns | anon | authenticated | service_role | PUBLIC |
|---|---|---|---|---|---|
| Role check (used everywhere incl. RLS policies) | `has_role` | — | EXECUTE | EXECUTE | REVOKE |
| Self-service user actions | `accept_legal_agreement`, `attach_referral`, `set_initial_role`, `log_onboarding_request_view` | — | EXECUTE | EXECUTE | REVOKE |
| Admin console reads | `admin_review_queue`, `admin_billing_orders_list`, `admin_billing_order_detail`, `admin_pending_manual_reviews`, `admin_title_history` | — | EXECUTE (RLS via `has_role` inside) | EXECUTE | REVOKE |
| Admin console writes | `admin_mark_order_paid`, `admin_review_manual_payment`, `admin_review_onboarding_request`, `admin_set_title_status`, `transition_title_status`, `grant_creator_role`, `revoke_creator_role` | — | EXECUTE (fn asserts role) | EXECUTE | REVOKE |
| Founder-only | `founder_vault_log`, `studio_vault_upsert_product`, `create_manual_vault_order` | — | EXECUTE (fn asserts role) | EXECUTE | REVOKE |
| Payments customer-facing | `submit_manual_payment_proof`, `record_payment_trace_event` | — | EXECUTE | EXECUTE | REVOKE |
| Edge-function-only | `sweep_abandoned_topups`, `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `pgmq_read_dlq`, `pgmq_delete_dlq`, `compute_royalty_run`, `claim_legacy_films`, `mfi_seats_taken`, `get_workspace_entitlement_snapshot` | — | REVOKE | EXECUTE | REVOKE |

Everything in this table past "Role check" is an **assumption** derived from repo-only evidence; each row must be validated against `has_function_privilege` before the REVOKE ships.

## 6. Confirmed vs. assumed vs. blockers

**Confirmed (from repo):**
- Pending migration file exists, matches hardened spec, has a guard test.
- 33 distinct RPC names called from `src/` / edge functions.
- Two edge functions define `SECURITY DEFINER` (topup-sweep, infra-health).

**Assumed (needs live check):**
- Which of the 32 unique function names are still `SECURITY DEFINER` after the latest `CREATE OR REPLACE`.
- Current `EXECUTE` grant matrix per function per role.
- Whether any function currently relies on the implicit `PUBLIC EXECUTE` from `anon` (e.g. pre-login flows).

**Blockers before executing PR-B2:**
1. No live `pg_proc` / `pg_proc_acl` snapshot in scope.
2. No cron/pg_net inventory in repo — scheduled callers can only be inferred.
3. No test harness that exercises unauthenticated RPC flows post-revoke.

## 7. Recommendation

Execute **PR-B1 only** next (source-only file move + one test path update, plus manually run the 5 preflight counts). Defer **PR-B2** until a live `SECURITY DEFINER` snapshot + caller matrix is produced via `mcp_get_security_advisors` — attempting a blanket REVOKE without it is the same class of risk that caused the prior 173→225 count drift.
