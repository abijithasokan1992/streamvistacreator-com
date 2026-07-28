# StreamVista Production-Readiness Baseline (Batch 1)

Read-only snapshot. No code, DB, storage, secret, or Edge Function was changed while producing this document.

## 1. Founder / privileged accounts (preserve at all costs)

| Role(s) | User ID | Email |
|---|---|---|
| founder, super_admin, admin | `75537ca1-e84f-4e80-a468-f38dc157a2ac` | `abijithasokan@crayonspictures.com` |
| super_admin, admin | `7119278d-c8f5-42bc-8dc4-077198eea87f` | `abijithasokan1992@gmail.com` |

These IDs are hard-preserved: no batch may remove roles, disable, or quarantine them. Every batch's post-check re-reads `public.user_roles` for both IDs and refuses to complete on mismatch.

## 2. Storage buckets (12)

| Bucket | Public | Notes |
|---|---|---|
| billing-proofs | private | payment proofs |
| branding | private | tenant branding assets |
| database_export_23_07_26 | private | one-off export; review for retention |
| dit-ingest-screenshots | private | DIT module (provisioned 2026-07-11) |
| dmca-evidence | private | takedown evidence |
| founder-vault | private | founder-only |
| marketing | **public** | site marketing assets |
| mfi-proof | private | |
| partner-logos | **public** | homepage logos |
| smart-uploads | private | creator uploads |
| title-ai-rights-docs | private | AI licensing docs |
| vault | private | founder/creator vault |

Two public buckets (`marketing`, `partner-logos`) are intentional. All others private. Batch 8 will verify per-bucket RLS on `storage.objects`, size/MIME limits, and signed-URL flows.

## 3. RLS matrix

All `public.*` tables have RLS enabled (query returned zero rows without RLS). No table exposed unrestricted. Policy-level correctness re-audited in Batch 14.

## 4. Applied vs pending migrations

- Applied: 28 migrations in `supabase/migrations/` (latest `20260727072115`).
- Pending (quarantined, NOT applied — safe by design):
  - `20260717_000000_title_canonical_backfill.sql`
  - `20260717_010000_revenue_statement_import.sql`
  - `20260718_000000_dit_ingest_screenshots_bucket.sql`
  - `20260727101915_buyer_marketplace_rpc.sql`
  - `20260727101916_user_profiles_privileged_guard.sql`
  - `20260727120000_admin_set_title_commercial_state.sql`
  - `20260727130000_onboarding_requests_field_lock_trigger.sql`
  - `20260728_quarantine_demo_titles.sql`

Each will be reviewed in its owning batch (title/revenue in 5, onboarding lock in 6, quarantine in 2, buyer RPC in 10, commercial state in 9, user_profiles guard in 14) before any application, with paired rollback SQL.

## 5. Edge Functions (86 present)

Full list captured. Batch 13 will run the per-function audit (authn / authz / input validation / CORS / secrets / idempotency / logging). No function was invoked, redeployed, or modified in Batch 1.

## 6. Current counters (pre-cleanup)

| Metric | Value |
|---|---|
| Total titles | 41 |
| Titles awaiting QC | 0 |
| Titles awaiting Legal | 0 |
| Published titles | 0 |
| Users | 48 |
| Recent uploads rows | 954 |
| Failed emails | 1 |
| Failed payments | 0 |
| Failed storage top-ups | 15 |
| Pending onboarding | 0 |
| Open tickets | 0 |

Title status distribution: 38 draft, 1 approved, 1 ready_for_distribution, 1 rejected.

The 41 titles align with the earlier demo-classification audit. Batch 2 will tag them reversibly and wire `productionFilters.ts` into every counter, at which point the operational reads should show a true zero.

The 15 failed storage top-ups match the "Storage alerts" card; Batch 8 will classify them (demo vs real) using the same criteria as the title audit.

The 1 failed email will be investigated in Batch 12.

## 7. What Batch 1 did NOT do

- No writes to any table.
- No migration applied.
- No bucket/policy change.
- No secret read or rotated.
- No Edge Function deployed.
- No user role modified.

## 8. Answers derived from Batch 1 (so we don't need to wait on Q&A)

1. **Cadence:** proceeding batch-by-batch with a written checkpoint at each stop.
2. **Founder accounts preserved:** the two IDs in section 1. Confirm if any additional account must be treated as founder-equivalent.
3. **Integrations kept OFF:** Razorpay stays in Test Mode; no real email sending to non-founder addresses during Batches 6–12 unless you say otherwise. No live webhook or payout will be triggered.
4. **Quarantine scope for Batch 2:** the drafted `20260728_quarantine_demo_titles.sql` targets the 18 confirmed rows from the earlier audit. Before Batch 2 applies anything I will re-print the exact list of row IDs and the reversible tags for your final go/no-go.

Awaiting your **go** to start Batch 2 (demo-data quarantine + shared production filter wiring). If you want a different founder set, a different quarantine manifest, or a different integration posture, tell me now and I'll amend before touching production state.
