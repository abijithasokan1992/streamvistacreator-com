# StreamVista Domain Model — Gap Analysis & Roadmap

_Audit date: 2026-07-11. Compares the live Lovable Cloud schema, APIs, and UI against the canonical JSON schemas in `/schemas`._
_No application code has been modified. This document is the deliverable for step 2 of the migration sequence._

---

## 1. Executive summary

StreamVista's live schema is functionally rich (170+ tables) but was grown organically. It **mostly implements** every domain object in the canonical model, but with three systemic problems:

1. **Multi-tenant identity is split three ways.** `workspaces` (operational), `organizations` (public/CMS), and `entity_profiles` (marketing) all act as the tenant root. The canonical `Organization` object has no single home.
2. **Two parallel Media Asset stacks coexist.** `studio_assets` (+ `studio_asset_files`, `title_media_versions`) is the real one; `media_assets` is a 11-column legacy table used only by admin CMS. Neither exposes the full canonical field set (contentType, rights, QC, distribution, technical).
3. **Money and licensing are fragmented.** `invoices` uses `*_paise` fields (INR-centric, no line items). `license_contracts` has no rights/territories/financials columns — those live in `deal_memos` (48 cols). The canonical `Licensing Contract` merges both.

The good news: the operational surface (ingest, QC-lite, distribution, notifications, audit, workflow) is already wired and only needs field additions, not restructuring.

Risk level to align: **Medium**. Additive migrations cover ~80% of the gaps; the remaining 20% are consolidations (media_assets vs studio_assets, deal_memos vs license_contracts) that need shim views before drop.

---

## 2. Object-by-object gap matrix

Legend: ✅ present · ⚠️ present but incomplete/renamed · ❌ missing · 🔀 split across multiple tables

| Canonical object | Live table(s) | Status | Key gaps |
| --- | --- | --- | --- |
| Organization | `organizations`, `workspaces`, `entity_profiles` | 🔀 | No unified `type` enum (Studio/Broadcaster/…), no `legalName`, `country`, `taxId`, `primaryContact`. Three overlapping tenant tables. |
| User | `auth.users` + `user_profiles` | ⚠️ | Missing `organizationId` link, `emailVerified`, `mfaEnabled`, `lastLoginAt`. `roles` lives in `user_roles`, not on user. |
| Role | `user_roles` (+ enum `app_role`) | ⚠️ | Only role name is stored; no `permissions[]`, `scope`, `description`. Permissions are hard-coded in RLS. |
| Project | `projects` | ⚠️ | Missing `code`, `type` enum, `startDate`/`endDate`, `status` enum, `members[]` (uses separate `producer_assignments`). Has extra production-specific columns (camera_brand, lens_brand) not in canonical. |
| Media Asset | `studio_assets` (primary) + `media_assets` (legacy) + `title_media_versions` | 🔀 | `studio_assets` missing: `contentType` enum, `originalTitle`, `genre[]`, `language`, `subtitleLanguages[]`, `releaseYear`, `durationMinutes`, `rights{}`, `posterUrl`, `trailerUrl`, `thumbnailUrl`. Technical fields present but flat (codec, resolution, fps). Two tables must merge. |
| Ingest Job | `ingest_jobs` (+ `ingest_job_items`) | ✅ | Missing canonical `source` values (`Aspera`, `Signiant`, `S3 Pull`, `FTP`, `API`) — current enum is drive/card/watch-folder only. No top-level `checksum{}`. `correlationId` not persisted. |
| QC Report | _none_ (partial in `title_review_*` tables) | ❌ | No dedicated QC table. `title_review_checklist`/`title_review_issues` are manual review only. No engine, score, or automated issue list. |
| Storage Object | `recent_uploads`, `storage_allocations`, embedded in `studio_asset_files` | 🔀 | No standalone storage-object table. Provider fixed to OCI in code; canonical enum includes AWS/Azure/GCP/OCI/B2/Local. `etag`, `storageClass`, `encryption{}` missing. |
| Licensing Contract | `license_contracts` + `deal_memos` | 🔀 | `license_contracts` has 17 cols but no rights/territories/financials — those are in `deal_memos`. `assetIds[]` is single-title only. `rightsType`/`rightsGranted` enums missing. |
| Distribution Delivery | `distribution_deliveries` (+ `distribution_queue`, `distribution_packages`, `distribution_partners`) | ✅ | Well-modeled. Missing canonical `packageSpec` enum values (`IMF`, `DPP`, `AS-11`, `Apple/Netflix Spec`). No `scheduledAt`. |
| Buyer | `entity_profile_buyer_ext` + `commercial_requests` + `partner_profiles` | 🔀 | No `buyers` table; buyer identity is inferred from `entity_profiles.entity_kind='buyer'`. No `watchlistAssetIds[]` join, no `acquisitionFocus[]`, no `verified` flag. |
| Offer | `offer_rounds` | ⚠️ | Missing `negotiationId`, `direction` enum, `expiresAt`, `resultingContractId`. `terms` is `jsonb` (unstructured). |
| Invoice | `invoices` + `manual_invoices` | ⚠️ | INR-only (`*_paise`, `gst_*`). No `lineItems[]` (single description). No `customer{}` object. Two overlapping tables. |
| Subscription | `subscriptions` | ⚠️ | Provider fields fragmented (stripe/razorpay/paddle columns side-by-side). No `entitlements{}` object (data lives on `plans`/`plan_assignments`). No `tier` enum. |
| Audit Log | `admin_audit_log`, `commercial_audit_log`, `entity_profile_audit_log`, `onboarding_audit_log`, `founder_vault_audit`, `mcp_audit_log`, `razorpay_audit_log` | 🔀 | Seven parallel audit tables, none matching canonical shape (`actor{}`, `outcome`, `correlationId`, `ipAddress`, `userAgent`). |
| Notification | `notifications` (in-app) + `email_send_log` + `onboarding_notifications` | 🔀 | Three parallel tables. Canonical `channel` union not represented. No `template`, `priority`, `deliveredAt`, `readAt` on the shared shape. |
| API Key | `api_keys` | ⚠️ | Only 7 cols; missing `prefix`, `scopes[]`, `ipAllowlist[]`, `expiresAt`, `lastUsedAt`, `revokedAt`, `status` enum. |
| Workflow | _none_ (implicit via `status` columns + edge functions) | ❌ | No workflow definition table. State machines are hard-coded in triggers and RPCs (`handle_global_platform_maintenance`, `sync_upload_to_media_cms`, etc.). |

---

## 3. Cross-cutting issues

### 3.1 Duplicate / overlapping tables

| Concern | Tables | Recommendation |
| --- | --- | --- |
| Tenant root | `organizations`, `workspaces`, `entity_profiles` | Keep `workspaces` as operational tenant, treat `organizations` + `entity_profiles` as public-facing views. Add FK `workspaces.organization_id`. |
| Media assets | `media_assets` (legacy), `studio_assets`, `title_media_versions` | Migrate `media_assets` rows into `studio_assets`; keep `title_media_versions` as version history. Drop `media_assets` after shim view. |
| Licensing | `license_contracts`, `deal_memos` | Extend `license_contracts` with rights/financials; make `deal_memos` a pre-contract negotiation artifact. |
| Invoices | `invoices`, `manual_invoices` | Merge into `invoices` with a `source` discriminator; move line items to a new `invoice_line_items` table. |
| Audit logs | 7 tables | Introduce single `audit_log` view over UNION; new writes go to canonical table. |
| Notifications | `notifications`, `email_send_log`, `onboarding_notifications` | Consolidate under a `notifications` table with `channel` enum; keep `email_send_log` as delivery-attempt history. |

### 3.2 Naming inconsistencies

- Currency: `paise` (int) vs canonical `amount` (numeric) + `currency` (ISO 4217).
- IDs: mostly `snake_case_id`, but external gateways use raw provider IDs (`razorpay_order_id`, `stripe_subscription_id`) — canonical uses generic `providerSubscriptionId`.
- Timestamps: mixed `_at` (canonical ✅) and legacy `_time` on a few older tables.
- Enums: some tables use Postgres enums (`org_kind`, `app_role`, `studio_slug`) and others use `text` + CHECK constraints (`ingest_jobs.status`, `studio_assets.status`). Standardize on Postgres enums.

### 3.3 Missing relationships (foreign keys)

- `studio_assets.contract_id` → `license_contracts.id` (currently unlinked).
- `distribution_deliveries.asset_id` → `studio_assets.id` (only `title_id` exists).
- `invoices.organization_id` → `workspaces.id` / `organizations.id` (currently user-scoped only).
- `notifications.organization_id` (multi-tenant scoping missing).
- `api_keys.created_by` → `auth.users(id)` — column exists but no FK constraint.

### 3.4 Incomplete workflows

| Workflow | Current state | Gap |
| --- | --- | --- |
| Asset lifecycle (Draft → Uploading → Processing → QC → Published → Archived) | `studio_assets.status` supports `active/archived/superseded` only | No `Draft`, `Processing`, `QC`, `Published` states; no QC gate. |
| Ingest retry/supersede | Implemented via edge functions | Not modelled as workflow definition; no runbook UI. |
| Contract lifecycle | `license_contracts.status` free-text | No enum, no signature-order enforcement. |
| Distribution ack | `distribution_deliveries.status` free-text | No timeout/failed transitions; no automated retry policy. |
| Offer round expiry | `offer_rounds` has no `expires_at` | Manual only; no scheduled expire job. |

### 3.5 UI / form gaps (spot-check)

| Surface | Missing vs canonical |
| --- | --- |
| Media CMS asset editor | No `contentType`, `genre`, `rights.territories`, poster/trailer/thumbnail URL fields. |
| Studio onboarding | Captures `studio_name` but not `Organization.type`, `country`, `taxId`. |
| Buyer profile | No watchlist editor; acquisition focus is free-text tags. |
| Admin > API keys | Create form only prompts for `name`; no scope selector or IP allowlist. |
| Admin > Invoicing | No line-item editor. |
| Admin > Workflow designer | Does not exist. |

---

## 4. Required migrations (schema-only, non-breaking first pass)

Grouped by risk. All migrations should be additive; drops happen only after shim views are proven.

### Phase A — Additive column adds (low risk)

1. `organizations`: add `type` enum, `legal_name`, `country`, `website`, `logo_url` (exists), `primary_contact` jsonb, `billing_tax_id`, `billing_address`, `billing_currency`.
2. `user_profiles`: add `organization_id` FK, `email_verified` bool, `mfa_enabled` bool, `last_login_at`.
3. `user_roles`: add `scope` enum(`platform`,`organization`,`project`), `permissions text[]`, `description`.
4. `projects`: add `code`, `type` enum, `start_date`, `end_date`, `status` enum.
5. `studio_assets`: add `content_type` enum, `original_title`, `genre text[]`, `language`, `subtitle_languages text[]`, `release_year`, `duration_minutes`, `rights jsonb`, `poster_url`, `trailer_url`, `thumbnail_url`, `contract_id` FK.
6. `ingest_jobs`: extend `job_mode` check to include `aspera`,`signiant`,`s3_pull`,`ftp`,`api`; add `checksum jsonb`, `correlation_id`.
7. `distribution_deliveries`: add `package_spec` enum, `scheduled_at`, `asset_id` FK to `studio_assets`.
8. `license_contracts`: add `licensor_id`, `licensee_id`, `rights_type` enum, `rights_granted text[]`, `territories text[]`, `languages text[]`, `start_date`, `end_date`, `financials jsonb`.
9. `offer_rounds`: add `negotiation_id`, `direction` enum, `expires_at`, `resulting_contract_id` FK.
10. `subscriptions`: add `tier` enum, `entitlements jsonb`.
11. `api_keys`: add `prefix`, `scopes text[]`, `ip_allowlist text[]`, `expires_at`, `last_used_at`, `revoked_at`, `status` enum.
12. `notifications`: add `channel` enum, `template`, `priority`, `data jsonb`, `delivered_at`, `read_at`, `correlation_id`, `attempts`.

### Phase B — New tables (medium risk)

- `qc_reports` — implements canonical QC Report; references `studio_assets`, `ingest_jobs`.
- `storage_objects` — canonical storage reference; back-fill from `recent_uploads` + `studio_asset_files`.
- `buyers` — canonical buyer identity; view over `entity_profiles WHERE entity_kind='buyer'` first, then promoted to table.
- `invoice_line_items` — extract from `invoices.description`.
- `workflow_definitions` + `workflow_transitions` — represent the (currently implicit) state machines.
- `audit_events` — canonical audit shape; union view over the 7 legacy tables during transition.

### Phase C — Consolidations (higher risk, requires shim views)

- Create view `v_media_assets_legacy` over `studio_assets` matching old `media_assets` shape; migrate rows; drop `media_assets`.
- Merge `manual_invoices` into `invoices` (add `source='manual'`); drop `manual_invoices`.
- Add `workspaces.organization_id` FK; back-fill from `user_profiles.organization_id`.
- Replace 7 audit tables with `audit_events` + views for backward compat.

### Phase D — Enum standardization (low risk, mechanical)

- Convert text-with-CHECK columns to real enums (`ingest_jobs.status`, `studio_assets.status`, `license_contracts.status`, `distribution_deliveries.status`, `invoices.status`, `subscriptions.status`).

---

## 5. Implementation roadmap

_Suggested sequencing over 4 milestones. Each milestone is independently shippable and reversible._

### Milestone 1 — Foundation additive (est. 1 migration, ~1 day)
Phase A migrations 1–4 (org, user, role, project). No UI changes required; shipped safely because all new columns are nullable.

### Milestone 2 — Media & Ingest alignment (est. 2 migrations, ~2 days)
Phase A migrations 5–7 + Phase B (`qc_reports`, `storage_objects`). Update `sync_upload_to_media_cms()` to populate new fields. Extend Media CMS asset editor form (Studio Workspace) to expose canonical fields behind an "Advanced metadata" panel — safe because fields default null.

### Milestone 3 — Commercial alignment (est. 2 migrations, ~2 days)
Phase A migrations 8–10 + Phase B `invoice_line_items`, `buyers`. Update commercial flows (`commercial_requests` → `offer_rounds` → `license_contracts`) to write structured terms. Introduce buyer watchlist join table.

### Milestone 4 — Ops & consolidation (est. 3 migrations, ~3 days)
Phase A 11–12 + Phase B `workflow_definitions`, `audit_events` + Phase C consolidations + Phase D enum standardization. Ship shim views first, migrate readers, then drop legacy tables.

### Milestone 5 — Verification (~1 day)
- Ajv validators generated from `/schemas/*.json`, run as pre-insert checks in edge functions.
- Integration tests: create → publish → license → deliver → invoice happy path.
- Update `admin_infra_snapshot` to include per-object canonical-conformance counts.

---

## 6. Out of scope for this alignment

- Splitting off a dedicated CMS/Sanity mirror (`mcp_sanity_*` tools are available but not required for canonical alignment).
- Currency multi-tenancy beyond INR (Phase A adds `billing_currency` and Phase C adds line items; a full FX layer is separate work).
- Real workflow engine (a definition table is enough; execution stays in edge functions).

---

## 7. Ready for next step

The next action in the sequence is **step 3 — Generate database migrations**. On approval, I'll produce Milestone 1's migration as the first PR-sized change so we can validate the pattern before proceeding to Milestones 2–4.
