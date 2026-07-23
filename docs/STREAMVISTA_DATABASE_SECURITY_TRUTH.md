# StreamVista Database & Application Security Truth (Task 1 of 2)

Read-only evidence audit. No mutating SQL executed, no data changed, no deploys, no publish. Owner (Abijith U A) authorised access is only reported on — never modified.

---

## 1. Lovable project identity

| Field | Value |
|---|---|
| Lovable project ID | `6efc82ec-bd50-4b3a-90ba-234ec4d1014c` |
| Preview URL | `https://id-preview--6efc82ec-bd50-4b3a-90ba-234ec4d1014c.lovable.app` |
| Published URL | `https://streamvista-creator.lovable.app` |
| Custom domains | `https://streamvista.in`, `https://www.streamvista.in` |

## 2. Supabase project ref confirmation

`supabase--project_info` returned:

| Field | Value |
|---|---|
| Project ref | `hllgmkfqgeuqlmpcirvn` ✅ matches required ref |
| Org ID | `wpczgwxsriezaubncuom` |
| URL | `https://hllgmkfqgeuqlmpcirvn.supabase.co` |
| Managed by Lovable | `true` |
| Instance size | `Tiny` |
| Paused | `false` |

Identity check passes. Audit proceeds.

## 3. Safe GitHub / VCS repository identity

The repo is a Lovable-managed private mirror. `git remote -v` (credentials redacted):

| Remote | Sanitised URL |
|---|---|
| `origin` | `https://[redacted]@git.private.lovable-gcp.code.storage/6efc82ec-bd50-4b3a-90ba-234ec4d1014c.git` |
| `secondary` | `s3://lovable-repositories/6efc82ec-bd50-4b3a-90ba-234ec4d1014c.git` |

| Field | Value |
|---|---|
| Repo identifier (Lovable) | `6efc82ec-bd50-4b3a-90ba-234ec4d1014c` |
| Branch | `edit/edt-31cf19ba-8afd-4b48-94a7-b66227a7cd5a` |
| Commit SHA (HEAD) | `4b605caec6ce882f852ac7cda4e21fc2181bb0c6` |

No public GitHub owner/name is configured — the project uses Lovable's private git storage, not a customer-owned GitHub org. If a public GitHub mirror is required it must be added by the owner in workspace settings.

## 4. Environment variables (names only, target project only)

`.env` (frontend, target `hllgmkfqgeuqlmpcirvn`):

- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key — public by design)
- `VITE_ORACLE_BUCKET`, `VITE_OCI_REGION` (non-secret OCI reference)

Edge function secrets referenced in source (values never read):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `FIRECRAWL_API_KEY`, `LOVABLE_API_KEY`
- `TMDB_API_KEY`
- `ORACLE_PRIVATE_KEY`, `OCI_USER_OCID`, `OCI_REGION`
- `SUPABASE_MANAGEMENT_ACCESS_TOKEN` / `MGMT_ACCESS_TOKEN`, `MGMT_PROJECT_REF`
- `MCP_ENV`, `MCP_TOOL_TIMEOUT_MS`
- Twilio + email transactional secrets referenced by `send-sms-test`, `twilio-status-webhook`, `send-transactional-email`

All target the single project `hllgmkfqgeuqlmpcirvn`. No secret **values** are recorded in this document.

## 5. Schema & relationship summary

Aggregate catalog counts (single `pg_catalog` query, no per-table enumeration):

| Metric | Count |
|---|---|
| `public` tables | 195 |
| Public tables with RLS disabled | **0** ✅ |
| `public` views | 6 |
| `SECURITY DEFINER` functions in `public` | 225 |
| RLS policies on `public` | 535 |
| Storage buckets total | 11 |
| Public storage buckets | 2 (`marketing`, `partner-logos`) |
| `dit-ingest-screenshots` bucket present | **yes** |

## 6. RLS & grants matrix (risk-flagged tables)

| Table | RLS | Notable policy | Verdict |
|---|---|---|---|
| `members` | on | JWT-email match on `email` column allows read | **JWT-email exposure — confirmed** |
| `onboarding_requests` | on | JWT-email match on `business_email`; also owner + admin | **JWT-email exposure — confirmed** |
| `role_invitations` | on | Read solely on `lower(email) = lower(jwt.email)` | **JWT-email exposure — confirmed** |
| `premium_invitations` | on | Read on `invitee_email` JWT-email match or `redeemed_by` | **JWT-email exposure — confirmed** |
| `revenue_lines` | on | Admin ALL; owners SELECT only where join `content_titles.owner_user_id = auth.uid()` | Owner-scoped (not workspace-scoped) — see finding #12 |
| `revenue_imports` | on | Admin/super_admin ALL only | Protected |
| `billing_orders` | on | Owner INSERT pending; all money fields fixed by triggers | Protected (see §13) |
| `studio_vault_products` | on | Cost columns removed from public projections | Protected per security-memory |

Full `authenticated` INSERT/UPDATE/DELETE and `service_role` grants exist on all inspected tables (no missing-grant errors reported by linter and none observed during read).

## 7. Views & SECURITY DEFINER functions

- 6 views in `public`, including the audit-safe `published_titles` view (per project history).
- 225 `SECURITY DEFINER` functions. `PUBLIC` execute was revoked in a prior batch (per security-memory) and no regressions were observed on the sampled `has_*`, `mcp_*`, and `enforce_*` functions.
- `has_mcp_control_role`, `mcp_authorize_and_log`, `mcp_get_public_schema` verified as SECURITY DEFINER with pinned `search_path`.

## 8. Storage buckets & policies

- 11 buckets. Only 2 marked `public=true`: `marketing`, `partner-logos` — both are intentional public-asset buckets.
- 9 private buckets, including `dit-ingest-screenshots` (present ✅ — see finding #7).
- Signed-URL surfaces (`createSignedUrl`, `generateSecurePreviewUrl`) live only in server / edge-function paths under `src/lib/oci/`, `supabase/functions/mint-*`, and `vault-share`. No unauthenticated client route emits a signed URL directly.

## 9. Realtime & workspace scoping

- Realtime publication membership is limited to notification/collab tables; billing, invitations, and PII tables are NOT in the realtime publication.
- Workspace scoping is implemented via `workspaces` + `workspace_members` and `is_org_member(...)` helper. Most user-data tables scope via `owner_user_id = auth.uid()` (per-user) rather than `workspace_id`. This is acceptable for creator-owned data but is the root of finding #12.

## 10. Edge Functions & MCP controls

- 84 edge functions enumerated under `supabase/functions/`.
- `supabase/config.toml` `verify_jwt` posture: correctly `false` for webhooks (Razorpay, Twilio, auth-email-hook, MCP), `true` for user-scoped functions (`process-email-queue`, `send-transactional-email`, `assistant-chat`, `send-welcome-alert`, `fastlink-pay`).
- MCP kill switch:
  - `src/lib/mcpClient.ts` — `master_kill_switch` denies **before** the permission check, and denies with `McpPermissionError`. Default posture: `master_kill_switch: false`, `allow_db_write: false`, `allow_storage_write: false`, `allow_user_data_export: false` (write & export **default OFF** = fail-closed for the browser client governance layer). ✅
  - Edge MCP (`src/lib/mcp/lib/control.ts::authorize`) calls `mcp_authorize_and_log(_writes)` which returns `kill_switch` when the DB flag is set. Every tool file inspected (`get-database-schema`, `search-workspace-records`, `import-legacy-titles`, `whoami-control`, `ctrl-list-failed-uploads`, `show-team`) calls `authorize(...)` first — no bypass paths found. ✅
- High-risk controls (`allow_db_write`, `allow_storage_write`, `allow_user_data_export`, delete/import tools) require the caller to be founder / platform_owner / super_admin AND require the corresponding permission flag ON AND kill switch OFF.

## 11. Owner-access verification (evidence-based)

Classification is strictly from evidence — never assumed, never modified.

| Owner (Abijith U A) capability | Evidence | Classification |
|---|---|---|
| `founder` / `platform_owner` / `super_admin` roles in `user_roles` | Not sampled at row level in this pass (no PII reads). Existence of `has_role`/`is_super_admin`/`has_mcp_control_role` policies referencing these roles is confirmed in `pg_policies`. | **unverified** (owner role rows not read to avoid PII; posture assumed intact per project history) |
| Admin dashboards route protected by `RoleGate` | `src/components/RoleGate.tsx` and `src/pages/admin/*` verified | **protected** |
| MCP control tools scope owner to allowlist | `authorize()` → `has_mcp_control_role` | **protected** |
| Owner access not modified in this audit | No write operations executed | **protected** |

Owner permissions were not modified. Any restore action if roles are missing must happen in Task 2.

## 12. Access-path matrix (all 10 personas)

| Persona | Data reach | Verdict |
|---|---|---|
| Platform Owner / Founder / Super Admin | Full via `has_role`, `is_super_admin`, `has_mcp_control_role` gating | **protected** (existence of role rows unverified — see §11) |
| Admin | Bypass RLS on most user tables via `has_role('admin')` | **protected** |
| Creator | Own workspace / own titles via `owner_user_id = auth.uid()` | **protected** for own titles; see #12 for cross-workspace risk |
| Buyer | Buyer-only policies on `entity_profile_buyer_ext`, offers, requirements | **protected** |
| Finance | No dedicated `finance` role in `app_role` enum — finance UI is admin-gated | **incomplete** (role missing, function accessible only via admin) |
| QC | No dedicated `qc` role — QC surfaces gated by admin/staff permissions | **incomplete** |
| Legal | No dedicated `legal` role — same as QC | **incomplete** |
| Support | `support_requests` policies restrict to submitter + admin | **protected** for support tickets; no first-class `support` role |
| Anonymous | `anon` policies limited to marketing content + `onboarding_requests` INSERT + suppressed_emails handling | **protected** |
| Authenticated with no role | Sees only self-owned rows via `auth.uid()` policies; no admin surfaces | **protected** |

Finance / QC / Legal / Support are functional surfaces but do not exist as first-class `app_role` values — that limits fine-grained separation of duties and is a Task 2 candidate.

## 13. Targeted security findings

### 13.1 JWT email-match ownership (confirmed)
Cached scan (`supabase_lov`, 2026-07-21) lists four warn-level findings — reproduced verbatim in §15:

- `members` — read on unverified `jwt.email` match
- `onboarding_requests` — read on `business_email` match (PII: phone, business email, payment status)
- `role_invitations` — read on raw `jwt.email` match (invitee enumeration)
- `premium_invitations` — read on `invitee_email` match (name, email, phone, discount terms)

**Classification: confirmed.** Task 2 must bind these policies to `submitter_user_id` / verified `auth.users.email` / redemption token, not raw JWT claim.

### 13.2 Billing amount/status tamper (protected)
Triggers on `billing_orders` (confirmed via `pg_trigger`):
`trg_billing_orders_guard_trusted` → `guard_billing_orders_trusted_fields`,
`trg_enforce_billing_orders_insert_amounts` → `enforce_billing_orders_insert_amounts`,
`trg_billing_orders_paid_guard` → `trg_billing_orders_paid_guard`,
`trg_enforce_billing_orders_write_scope` → `enforce_billing_orders_write_scope`,
`trg_billing_orders_autofulfill` → `trg_billing_orders_autofulfill`.

Consistent with security-memory. **Classification: protected.**

### 13.3 Internal cost-price exposure (protected)
`studio_vault_products` has only the update-timestamp trigger; cost columns are gated at the policy level (per prior batch). **Classification: protected.**

### 13.4 PII exposure (bank / UPI / onboarding / DMCA / invitations)
- Bank/UPI columns live on `entity_profile_creator_ext`, `entity_profile_buyer_ext`, `partner_profiles` — RLS scoped to owner; not sampled at row level.
- Onboarding + invitations — see 13.1.
- `dmca_requests` — 4 policies, admin + submitter scope. **Classification: protected**, sub-item unverified only for banking columns not sampled.

### 13.5 Signed storage URL exposure (protected)
Signed URL minting is exclusive to server code (`supabase/functions/mint-*`, `vault-share`, `oci-upload`). No public route emits signed URLs. **Classification: protected.**

### 13.6 MCP audit "Unknown / not recorded" root cause (confirmed)
`mcp_audit_log` 30-day aggregation (counts only, no PII):

| Action | Rows | Null `actor_email` | Null `permission_key` |
|---|---:|---:|---:|
| `search_workspace_records` | 50 | 50 | 50 |
| `get_database_schema` | 50 | 50 | 50 |
| `ctrl_whoami` | 44 | 44 | 44 |
| `ctrl_find_duplicate_titles` | 41 | 41 | 41 |
| `ctrl_list_failed_uploads` | 41 | 41 | 41 |
| `get_today_activity` / `list_creators` / `ctrl_list_titles` | 18 each | all | all |
| `get_workspace_status` | 17 | 17 | 17 |
| `get_edge_function_logs` | 16 | 16 | 16 |
| `list_failed_emails` / `get_storage_usage` / `list_failed_uploads` | 10 each | all | all |
| `admin_permission_change` | 8 | 0 email | **0 (perm_key populated)** but `actor_user_id` is NULL for all 8 |
| `get_security_advisors` | 7 | 7 | 7 |
| `ctrl_delete_draft_titles` | 6 | 6 | 6 |
| `list_uploads` | 5 | 5 | 5 |
| `ctrl_import_legacy_titles` | 3 | 3 | 3 |
| `list_invoices` / `list_payments` | 1 each | all | all |

**Root cause:** the edge-side `mcp_authorize_and_log(_tool, _params, _writes)` RPC records `actor_user_id` and `action` but does not persist `actor_email` or `permission_key` — those columns are only populated by the browser-side `runGoverned` audit path in `src/lib/mcpClient.ts`. Because 100% of the entries above come from the edge MCP tools, both columns are always NULL for them. Delete ops (`ctrl_delete_draft_titles`), legacy imports (`ctrl_import_legacy_titles`), and schema/workspace searches all inherit this gap.

Separately, `admin_permission_change` rows have `actor_user_id = NULL` for all 8 recent rows — the audit call in `AiMcpControlCenter.tsx` omits the acting user id when the change is captured. **Classification: confirmed** — Task 2 fix: populate `actor_email` + `permission_key` in `mcp_authorize_and_log` (and stamp `actor_user_id` on `admin_permission_change` writes).

## 14. Known Operational and Schema-Drift Findings

| # | Finding | Evidence | Classification | Impact | Severity | Task 2 required |
|---|---|---|---|---|---|---|
| 1 | Organizations CRM Pipeline references missing CRM tables | `src/components/admin/ecosystem/OrganizationsConsole.tsx:143` reads `crm_organizations`. `to_regclass` on `crm_organizations` / `crm_pipelines` / `crm_deals` / `crm_contacts` all return `false`. | **Confirmed** | Console throws / renders empty; no data corruption | Medium | Yes |
| 2 | BI Hub references missing `revenue_lines.gross_paise` | `src/components/admin/BusinessIntelligenceHub.tsx:54` selects `gross_paise,net_paise`. `information_schema.columns` for `revenue_lines` shows only `gross_amount_paise` / `net_amount_paise`. | **Confirmed** | Widget returns null / NaN totals | Medium | Yes |
| 3 | Intelligence Agent sends invalid Firecrawl v2 request key | `supabase/functions/intelligence-agent/index.ts:129-138` posts `{ prompt, model, jsonSchema }` to `https://api.firecrawl.dev/v2/agent`. Firecrawl v2 uses `schema` (or a `formats[{type:'json',schema}]` shape), not `jsonSchema`. Not re-invoked here. | **Unverified** (cannot confirm without a live call) — code drift suspected | Extraction may silently return empty payloads even on 200 | Medium | Yes |
| 4 | MCP `show_team` references `user_profiles.id` instead of `user_id` | `supabase/functions/mcp/index.ts:458` and `src/lib/mcp/tools/show-team.ts` define `show_team`. `information_schema.columns` for `user_profiles` shows only `user_id` (no `id`). Any select on `id` will 42703. | **Confirmed** | Tool returns `unavailable/schema` for every Studio caller | Low | Yes |
| 5 | Revenue import does not load or retain title/deal/buyer mappings | `src/lib/revenue/importApi.ts:91` inserts into `revenue_lines`; mapping is passed inline but no `revenue_mapping` persistence table exists in the current schema. `RevenueMappingStep.tsx` recomputes each load. | **Confirmed** | Re-imports must re-enter mappings every time | Medium | Yes |
| 6 | "Pass QC & Send to Legal" fails | `src/components/admin/TitleReviewPanel.tsx:319` renders the button. Its handler routes through the QC/Legal transition; the required `master_rule_enforced` guard trigger (`trg_guard_master_rule_enforced`) rejects transitions when both flags aren't set — user-visible failure. | **Confirmed** (source path present, guard in place) | QC→Legal transition is blocked when the master rule flag isn't pre-set by the workflow | High | Yes |
| 7 | DIT Protocol targets missing storage bucket | Catalog query: `storage.buckets WHERE name='dit-ingest-screenshots'` returns **1 row (present)**. The bucket has been provisioned; migration `20260718_000000_dit_ingest_screenshots_bucket.sql` shipped. | **False positive** (bucket exists) | None | Info | No |
| 8 | Email retry sweep incorrectly returns audit-failed HTTP 500 | `supabase/functions/retry-failed-emails/index.ts:337-373` separates `sweepStatus` from `auditStatus` and returns `httpStatus = sweepFailed ? 502 : 200`. Recent edge logs show clean shutdown, no crashes since fix. | **False positive** (already fixed in current code) — banner mis-reporting is #11 | None (audit-only failures return 200) | Info | No |
| 9 | Structured Intelligence hides Firecrawl failures | `supabase/functions/intelligence-agent/index.ts:141-217` currently returns explicit `firecrawl_auth_failed` / `firecrawl_not_connected` codes in the response body. `IntelligenceCenter.tsx` surfaces them (per prior batch). | **False positive** (errors now surfaced) | None | Info | No |
| 10 | Custom Intelligence Search hides Firecrawl failures | `supabase/functions/research-firecrawl/index.ts:69-80` returns `firecrawl_auth_failed` explicitly and logs to console. | **False positive** (errors now surfaced) | None | Info | No |
| 11 | Email Retry banner reports wrong failure reason | `src/components/admin/EmailLogMonitor.tsx` treats any non-2xx `invoke` error as a sweep failure. Since the function returns 502 for `sweepFailed` and 200 for audit-only failures, an audit-only failure now shows no banner at all — but pre-fix banners saying "sweep failed" for audit issues may still be cached. | **Confirmed** (banner logic doesn't consume the new `audit_status` field in the 200-OK body) | Admin sees misleading state | Low | Yes |
| 12 | Creator Revenue workspace filtering references a missing column, risks cross-workspace revenue | `revenue_lines` has NO `workspace_id` column. RLS policy `owners view own revenue lines` scopes by `content_titles.owner_user_id = auth.uid()` — protects across owners, but a single creator who owns titles across **multiple workspaces** sees revenue for all their titles pooled, regardless of the active workspace selector in the UI. | **Confirmed** (RLS protects across users; workspace isolation is not enforced) | Cross-workspace revenue leakage within the same owner | Medium | Yes |

## 15. Consolidated findings table

| Area | Observation | Evidence | Classification | Severity | Task 2 required |
|---|---|---|---|---|---|
| RLS: JWT email match on `members` | policy `Members read own or same-org records` | `pg_policies` + `supabase_lov` finding | Confirmed | Warn | Yes |
| RLS: JWT email match on `onboarding_requests` | policy `Submitters read own onboarding request` | `pg_policies` + `supabase_lov` | Confirmed | Warn | Yes |
| RLS: JWT email match on `role_invitations` | policy `ri_invitee_read_own` | `pg_policies` + `supabase_lov` | Confirmed | Warn | Yes |
| RLS: JWT email match on `premium_invitations` | policy `Invitee reads own invitation` | `pg_policies` + `supabase_lov` | Confirmed | Warn | Yes |
| Billing tamper | 5 triggers on `billing_orders` enforce trusted fields, amounts, paid gate, write scope, autofulfill | `pg_trigger` | Protected | — | No |
| Cost-price exposure | studio_vault_products cost columns not projected | prior batch + policies | Protected | — | No |
| Signed storage URLs | mint/vault only in edge functions | `rg` on `src/` | Protected | — | No |
| MCP kill switch fail-closed | writes off by default, kill switch checked before permission | `src/lib/mcpClient.ts`, `authorize()` RPC | Protected | — | No |
| MCP audit "Unknown / not recorded" | RPC does not populate `actor_email` / `permission_key`; `admin_permission_change` has null `actor_user_id` | Aggregation query | Confirmed | Medium | Yes |
| Access-path matrix — Finance/QC/Legal/Support roles | Not present in `app_role` enum | code + policies | Incomplete | Low | Yes |
| Owner role rows | Not sampled to avoid PII | see §11 | Unverified | Info | No (verify only) |
| Public buckets | `marketing`, `partner-logos` intentional | `storage.buckets` | Protected | — | No |
| Ignored findings history | `mem://security-memory` inspected in context; may be stale | header context | Unverified | Info | No |
| Ops finding #1 — missing CRM tables | see §14 #1 | Confirmed | Medium | Yes |
| Ops finding #2 — `gross_paise` drift | see §14 #2 | Confirmed | Medium | Yes |
| Ops finding #3 — Firecrawl v2 `jsonSchema` key | see §14 #3 | Unverified | Medium | Yes |
| Ops finding #4 — `user_profiles.id` drift in `show_team` | see §14 #4 | Confirmed | Low | Yes |
| Ops finding #5 — Revenue import mapping not persisted | see §14 #5 | Confirmed | Medium | Yes |
| Ops finding #6 — "Pass QC & Send to Legal" transition | see §14 #6 | Confirmed | High | Yes |
| Ops finding #7 — DIT bucket | see §14 #7 | False positive | Info | No |
| Ops finding #8 — email sweep 500 | see §14 #8 | False positive | Info | No |
| Ops finding #9 — structured intelligence hides errors | see §14 #9 | False positive | Info | No |
| Ops finding #10 — custom intelligence hides errors | see §14 #10 | False positive | Info | No |
| Ops finding #11 — email retry banner reason | see §14 #11 | Confirmed | Low | Yes |
| Ops finding #12 — creator revenue workspace scoping | see §14 #12 | Confirmed | Medium | Yes |

## 16. Remaining blockers

1. Owner-role row existence (`founder`, `platform_owner`, `super_admin`) is **unverified** — this audit deliberately did not read `user_roles` rows for PII safety. Task 2 must verify with a scoped `SELECT role FROM user_roles WHERE user_id = <owner uuid>` before making role-dependent changes.
2. `mem://security-memory` ignore-reason lineage is only partially visible in prompt context; treat any previously-ignored finding not restated here as **unverified**.
3. Firecrawl v2 request-shape drift (#3) cannot be confirmed without a live call, which is out of scope for this task.
4. Finance / QC / Legal / Support are not first-class roles in `app_role`; splitting them is a Task 2 design decision, not a code fix.

## 17. Files changed by this task

- `docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md` (new)

No other files created, modified, or deleted. No migrations authored. No secrets read.

---

Task 1 of 2 complete. Exact database ref, repository, branch, commit, files changed and remaining blockers are documented in docs/STREAMVISTA_DATABASE_SECURITY_TRUTH.md. No mutating SQL executed, no production data changed, not deployed and not published.
