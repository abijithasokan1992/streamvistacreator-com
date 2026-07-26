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

---

# PR-B Extension — Read-Only Planning Addendum

_Documentation-only. No application code, no SQL migrations, no deploys, no production data mutations, no Supabase settings changes._

## 8. Vercel Inventory (read-only)

### 8.1 Active production project
- **Active**: `streamvistacreator-com` — deploys the current `main` branch of `abijithasokan1992/streamvistacreator-com` and serves the canonical hostnames (`streamvista.in`, `www.streamvista.in`) alongside the Lovable-hosted preview/publish endpoints.
- **Retained (non-cleanup) siblings**: `antigravity-live`, `unionautosparesmarine`, `abijith-asokan`, `streamvista`, `audit`, `audit-dyei`. These are user-flagged keepers and are out of scope for cleanup.

### 8.2 Duplicate / deleted projects (user-flagged)
| Project | Status | Reason retained/removed |
|---|---|---|
| `frontend-next` | Slated for deletion | Duplicate scaffold, no traffic |
| `streamvistacreator-com-h3kr` | Slated for deletion | Auto-generated fork of active project |
| `streamvistacreator-com-zvrc` | Slated for deletion | Auto-generated fork of active project |
| `streamvistacreator-com-hxvz` | Slated for deletion | Auto-generated fork of active project |
| `nextjs-boilerplate` | Slated for deletion | Template scaffold, never promoted |

### 8.3 Deployment mapping (target state)
```text
GitHub: abijithasokan1992/streamvistacreator-com (main)
   └── Vercel project: streamvistacreator-com
          ├── Production alias: streamvista.in
          ├── Production alias: www.streamvista.in
          └── Preview aliases: PR-scoped *.vercel.app
Lovable preview/publish: id-preview--6efc82ec-...lovable.app / streamvista-creator.lovable.app
```
Any other Vercel project bound to the same GitHub repo is a duplicate and must be unlinked before deletion to avoid double-deploys on push.

### 8.4 Historical vs active checks (to be performed in Vercel UI)
For each cleanup-candidate project, confirm before deletion:
1. **Last deployment age** — must be older than the last active-project deployment.
2. **Domain bindings** — no custom domain (only `*.vercel.app`).
3. **Git integration** — either unlinked or pointing to a stale branch not used in production.
4. **Env var uniqueness** — no secrets that don't already exist on the active project.
5. **Traffic** — zero requests in the last 30 days per Vercel Analytics.

### 8.5 Cleanup verification checklist (post-user-action)
- [ ] Only 7 projects remain: 1 active + 6 flagged keepers.
- [ ] `streamvistacreator-com` still resolves at `streamvista.in` and `www.streamvista.in`.
- [ ] A fresh push to `main` triggers exactly one Vercel production deployment.
- [ ] No orphaned domain bindings appear under Team → Domains.
- [ ] Vercel webhook count on the GitHub repo matches the retained project count.

## 9. Safe Cleanup Automation (dry-run, recommendation-only)

**Constraint**: no deletion API calls, no `git push --delete`, no Supabase mutations. Output = a Markdown/JSON report only.

### 9.1 Inputs (all read-only)
- Vercel REST: `GET /v9/projects`, `GET /v6/deployments`, `GET /v9/projects/{id}/domains` (requires a read-only token supplied by the user).
- GitHub REST: `GET /repos/{owner}/{repo}/branches`, `GET /repos/{owner}/{repo}/pulls?state=all`.
- Local repo: `supabase/migrations-pending/*.sql`, `supabase/migrations/*.sql`.
- Local artifacts: `dist/`, `.vercel/`, `coverage/`, `node_modules/.cache/`, `.lovable/tmp/`.

### 9.2 Workflow steps
1. **Vercel inventory** — list every project, last-deploy timestamp, linked repo/branch, domain count, 30-day request count. Flag any project with (linked to `abijithasokan1992/streamvistacreator-com`) AND (name ≠ `streamvistacreator-com`) as `duplicate-candidate`.
2. **GitHub branch/PR sweep** — list branches with no commits in 90 days and closed/merged PRs whose branch still exists. Flag as `branch-cleanup-candidate`. Never call the delete endpoint.
3. **Pending migrations** — enumerate `supabase/migrations-pending/`. For each file emit `{filename, sha256, size, last_modified}`; cross-check that the filename is not already present under `supabase/migrations/`.
4. **Stale artifacts** — walk the workspace for build outputs and caches; report size and last-modified. No `rm`.
5. **Report** — write `.lovable/reports/cleanup-dry-run-<UTC>.md` (planning only; not committed by this task) with all findings grouped as: `SAFE_TO_DELETE`, `NEEDS_HUMAN_REVIEW`, `KEEP`.

### 9.3 Guardrails
- Fail closed if any write scope is detected on the supplied tokens.
- Refuse to run against the production Supabase project (assert against project ref allow-list of `""` — i.e. blocked by default).
- All destructive verbs (`delete`, `remove`, `drop`, `rm`, `push --delete`) are lint-banned in the workflow file.
- Report is idempotent: running twice produces identical output modulo timestamps.

## 10. Verification Report template

Use this template each time a PR-B slice is proposed for execution. Fill in, don't infer.

```markdown
# PR-B Verification Report — <slice-name> — <UTC timestamp>

## Repository
- Repo: abijithasokan1992/streamvistacreator-com
- Branch: <branch>
- Commit: <full sha>
- Author of head commit: <name>
- Diff scope: <files touched / LOC>

## Pending migrations
- Files in supabase/migrations-pending/: <list with sha256>
- Files proposed to promote in this slice: <list>
- Files intentionally deferred: <list + reason>

## Vercel inventory snapshot
- Active project: streamvistacreator-com
- Duplicate-candidate projects: <list or "none">
- Domain bindings verified: yes/no
- Last production deploy: <sha, timestamp>

## CI status
- GitHub Actions run: <url>
- Node version: 22
- Vitest: <passed/failed counts>
- Typecheck (tsgo): pass/fail
- Lint: pass/fail
- Security workflow: pass/fail

## Build / typecheck / lint
- `bun install`: pass/fail, lockfile clean yes/no
- `bun run build`: pass/fail, bundle size delta
- `tsgo`: pass/fail
- Any new warnings: <list>

## Security review
- security--get_scan_results: <summary>
- security--run_security_scan: <summary>
- SECURITY DEFINER inventory delta vs. previous report: <n>
- New RLS policies introduced: <list>

## Blockers
- <list, or "none">

## Approvals required
- [ ] Engineering owner: <name>
- [ ] Security owner: <name>
- [ ] Product/founder sign-off (for founder-vault touching slices only): <name>
```

## 11. Hardened Migration Validation — `20260717_000000_title_canonical_backfill.sql`

**Read-only validation summary. No migration was executed. No SQL was run against production. No file contents were modified.**

### 11.1 Identity
- Path: `supabase/migrations-pending/20260717_000000_title_canonical_backfill.sql`
- SHA-256: _to be recorded by running `sha256sum` locally before promotion; recorded in the §10 report at promotion time._
- Size / line count: captured at promotion time.

### 11.2 Safety properties (from static reading only)
- **Idempotent**: uses `IF NOT EXISTS` on column adds and `ON CONFLICT DO NOTHING` on unique index guards.
- **Non-destructive**: no `DROP`, no `TRUNCATE`, no `DELETE`, no `UPDATE` outside guarded backfill blocks.
- **Type-safe**: `jsonb_typeof(...) = 'array'` guards on every jsonb array read; regex-based integer parsing before `::int` casts.
- **Scope-limited**: touches only `public.content_titles` and adds `client_draft_id` uniqueness; does not alter auth, storage, or billing objects.
- **RLS-aware**: privileged-role RLS policies added in the same file so post-backfill reads/writes stay locked down.

### 11.3 Guard test
- Test file: `src/test/migrations/title-canonical-backfill.test.ts` (already present per prior audit).
- Coverage claimed: idempotency, jsonb type guards, integer parse guards, client_draft_id uniqueness, RLS role gating.
- Action for promotion: rerun the guard test in CI on the promotion PR; attach the run URL to the §10 report.

### 11.4 Preflight queries (read-only, to be executed manually via `supabase--read_query` before promotion, not now)
1. `SELECT count(*) FROM public.content_titles WHERE client_draft_id IS NULL;`
2. `SELECT count(*) FROM public.content_titles WHERE jsonb_typeof(<jsonb_col>) IS DISTINCT FROM 'array';` for each jsonb column touched.
3. `SELECT count(*) FROM public.content_titles WHERE <string_int_col> !~ '^-?\d+$';`
4. `SELECT indexname FROM pg_indexes WHERE tablename = 'content_titles';` — confirm target unique index does not already exist.
5. `SELECT policyname FROM pg_policies WHERE tablename = 'content_titles';` — confirm no name collision with policies the migration will add.

### 11.5 Rollback notes
- **Column adds**: reversible via `ALTER TABLE ... DROP COLUMN IF EXISTS client_draft_id;` — safe only if no downstream code depends on it (post-promotion, code will depend on it → rollback becomes a code+DB coordinated revert PR).
- **Unique index**: reversible via `DROP INDEX IF EXISTS ...;`.
- **RLS policies**: reversible via `DROP POLICY IF EXISTS ... ON public.content_titles;`.
- **Backfill data**: not reversible in-place; the pre-backfill values are not preserved. Mitigation: take a logical snapshot of `content_titles` (COPY … TO) immediately before promotion and store it under `ops/backups/` outside the repo.
- No trigger, function, or grant is added by this migration, so rollback does not need to touch `pg_proc` ACLs.

### 11.6 Explicit non-execution statement
This addendum performs zero execution:
- No `supabase--migration` call was made.
- No `supabase--read_query` / `supabase--insert` call was made.
- No file under `supabase/migrations/` or `supabase/migrations-pending/` was created, edited, moved, or deleted.
- No deploy, publish, or CI trigger was initiated.

Promotion of this migration remains gated on: (a) a filled §10 Verification Report, (b) executed preflight queries from §11.4, (c) captured pre-backfill snapshot per §11.5, and (d) explicit approval recorded in the report.
