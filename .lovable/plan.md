## Goal
Produce one read-only evidence document at `docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md`. No fixes, no mutating SQL, no deploys, no publish, no Task 2. Owner (Abijith U A) authorised access is preserved and only reported on — never modified.

## Hard stops (fail-closed identity check first)
- Lovable project id `6efc82ec-bd50-4b3a-90ba-234ec4d1014c` + preview / published / custom domain URLs.
- `supabase--project_info` must return ref `hllgmkfqgeuqlmpcirvn`. Any other ref → write only the identity-mismatch section and stop.
- Git: `git remote -v`, `git rev-parse --abbrev-ref HEAD`, `git rev-parse HEAD`. Redact any embedded credentials/tokens in remote URLs; record only safe `owner/name` + sanitised URL.
- Env var names from `.env`, `.env.example`, `supabase/config.toml`, edge function source references (names only, target project only). Never read or print secret values.

## Allowed operations
Read-only only: `code--view`, `code--exec` (git + `rg` + `ls` only), `supabase--project_info`, `supabase--linter`, `supabase--read_query` (catalog SELECT only — no RPC, no application function, no edge function invocation), `security--get_scan_results` (cached only; no forced rescan), `project_monitoring--list_pending_findings`, `supabase--edge_function_logs` (existing logs only).

Forbidden: migrations, INSERT/UPDATE/DELETE/UPSERT/MERGE/TRUNCATE/DROP/ALTER/GRANT/REVOKE, RPC/application/edge function invocation, edge function deploy, storage mutations, publishing, reproducing any of the 12 operational failures (no Firecrawl calls, email retries, imports, uploads, task creation, QC transitions).

## Inspection plan
1. **Identity & environment** — as above.
2. **Schema & relationships** — `pg_tables`, `information_schema.table_constraints` + `key_column_usage` for touched risk areas only. Aggregate counts, not per-table enumeration of all 190+ tables.
3. **RLS & grants matrix** — `pg_tables.rowsecurity`, `pg_policies`, `information_schema.role_table_grants` for risk-flagged tables. Flag RLS off, `USING (true)`, grants exceeding policy scope, missing service_role grants for edge-function-touched tables.
4. **Views & SECURITY DEFINER functions** — `pg_views`, `pg_proc` where `prosecdef=true`; `proacl` for `PUBLIC` execute; `proconfig` for `search_path`.
5. **Storage buckets & policies** — `storage.buckets` (public flag), `pg_policies` where schema='storage'. Cross-reference signed URL surfaces via `rg` (`createSignedUrl`, `generateSecurePreviewUrl`).
6. **Realtime / workspace scoping** — `supabase_realtime` publication membership; policy scoping to `workspace_id` / `owner_id`.
7. **Edge Functions & MCP** — enumerate `supabase/functions/*`; cross-check `supabase/config.toml` `verify_jwt` flags. MCP: `src/lib/mcp/tools/**`, `src/lib/mcp/lib/control.ts`, `src/lib/mcpClient.ts`. Verify `authorize()` on every tool, kill-switch precedence, writes=true handling.
8. **Targeted security risk checks** (one subsection each):
   - JWT email-match ownership: `members`, `onboarding_requests`, `role_invitations`, `premium_invitations`.
   - Billing amount/status tamper: triggers on `billing_orders`, `billing_manual_payment_submissions` via `pg_trigger` + `pg_proc`.
   - Internal cost-price exposure: `studio_vault_products`, `billing_price_versions`, views.
   - PII: bank/UPI, onboarding, DMCA, invitations.
   - Signed storage URL exposure to unauthenticated callers.
   - MCP audit "Unknown / not recorded" root cause across delete ops, legacy imports, DB writes, storage writes, user-data exports, schema/workspace searches — counts and action-name distributions only, no PII.
9. **Fail-closed high-risk controls** — kill switch default, `runGoverned` deny-on-master_kill_switch, `authorize({writes:true})` → `mcp_authorize_and_log(_writes=true)` returning `kill_switch`.
10. **Access-path matrix** — separately posture-report for: Platform Owner / Founder / Super Admin, Admin, Creator, Buyer, Finance, QC, Legal, Support, Anonymous, Authenticated-with-no-role. **Classify owner access strictly from evidence as protected, incomplete or unverified — never assume and never modify it.**
11. **Existing findings reconciliation** — pull cached `security--get_scan_results` and `project_monitoring--list_pending_findings`. Include all active and previously-ignored findings; if `mem://security-memory` or ignore reasons are inaccessible, mark them **unverified** rather than blocking the audit. Nothing silently dismissed.

## Known Operational and Schema-Drift Findings
New required section verifying these 12 findings using code, catalog metadata and existing logs only — no reproduction:

| # | Finding | Verification approach (read-only) |
|---|---|---|
| 1 | Organizations CRM Pipeline references missing CRM tables | `rg` in `src/components/admin/ecosystem/` for CRM table names; check `pg_tables` for existence |
| 2 | BI Hub references missing `revenue_lines.gross_paise` | `rg` for `gross_paise`; `information_schema.columns` for `revenue_lines` |
| 3 | Intelligence Agent sends invalid Firecrawl v2 request key | `code--view supabase/functions/intelligence-agent/index.ts` — inspect request body keys vs Firecrawl v2 spec; do NOT call Firecrawl |
| 4 | MCP `show_team` references `user_profiles.id` instead of `user_id` | `rg` in `src/lib/mcp/tools/**` for `show_team`; column check via `information_schema.columns` |
| 5 | Revenue import does not load/retain title/deal/buyer mappings | `code--view src/components/revenue/RevenueMappingStep.tsx`, `src/lib/revenue/mapping.ts` — inspect persistence path |
| 6 | "Pass QC & Send to Legal" fails | `rg` for button handler; inspect QC/Legal RPC & trigger definitions in `pg_proc` |
| 7 | DIT Protocol targets missing storage bucket | `storage.buckets` catalog query for `dit-ingest-screenshots`; compare against `supabase/migrations-pending/20260718_000000_dit_ingest_screenshots_bucket.sql` |
| 8 | Email retry sweep returns audit-failed HTTP 500 | `code--view supabase/functions/retry-failed-emails/index.ts`; cached `supabase--edge_function_logs` |
| 9 | Structured Intelligence hides Firecrawl failures | `code--view` intelligence functions/components; check error surfacing |
| 10 | Custom Intelligence Search hides Firecrawl failures | Same code paths + `IntelligenceCenter.tsx` |
| 11 | Email Retry banner reports wrong failure reason | `code--view src/components/admin/EmailLogMonitor.tsx` — trace banner reason source |
| 12 | Creator Revenue workspace filtering references missing column, risks cross-workspace exposure | `rg` for Creator revenue query; `information_schema.columns` for referenced `workspace_id`; check RLS on `revenue_lines` / `revenue_imports` |

For each finding record: **evidence** (file:line / table / policy), **classification** (confirmed / protected / false positive / unverified), **impact**, **severity** (info / low / medium / high / critical), **Task 2 required** (yes/no).

## Deliverable
Single markdown file `docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md`. **Files changed** means files created or modified in this task; preserve unrelated existing repository changes and do not overwrite them.

Sections in order:
1. Lovable project identity
2. Supabase project ref confirmation (`hllgmkfqgeuqlmpcirvn`)
3. Safe GitHub repo identity (owner/name, branch, commit SHA, sanitised URL)
4. Environment variable names & target project
5. Schema & relationship summary
6. RLS & grants matrix
7. Views & SECURITY DEFINER functions
8. Storage buckets & policies
9. Realtime & workspace scoping
10. Edge Functions & MCP controls (kill switch, fail-closed verdicts)
11. Owner-access verification (strictly evidence-based: protected / incomplete / unverified — never modified)
12. Access-path matrix (10 roles)
13. Targeted security findings
14. **Known Operational and Schema-Drift Findings** (12 items above)
15. Consolidated findings table — Area | Observation | Evidence | Classification | Severity | Task 2 required | Notes
16. Remaining blockers
17. Files changed (this task should show only `docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md`)

## Output guardrails
Do not print or write: secret values, access/refresh tokens, password hashes, personal emails, phone numbers, bank/IFSC/UPI details, payment identifiers, invitation tokens, signed URLs, private media paths. Only column names, aggregate counts, policy definitions, function signatures, file paths.

No remediation SQL, bootstrap files, or repair code — those belong to Task 2.

## Closing
Response ends with exactly:

`Task 1 of 2 complete. Exact database ref, repository, branch, commit, files changed and remaining blockers are documented in docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md. No mutating SQL executed, no production data changed, not deployed and not published.`

Then stop. Do not begin Task 2.
