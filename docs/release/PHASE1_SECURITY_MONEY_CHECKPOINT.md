# Phase 1 — Security & Money Checkpoint

Branch: `chatgpt/production-readiness`

This checkpoint follows `docs/release/COMPLETED_WORK_LOCK.md`: completed work is preserved and is not rewritten without current regression evidence.

## Safety state

- No deployment or publish.
- No production database mutation.
- No migration execution.
- No data deletion.
- No payment or payout execution.
- No secret rotation or exposure.

## P0 item status

| # | Item | Current source-level status | Next evidence required |
|---|---|---|---|
| 1 | `hard_disk_intakes.admin_notes` overwrite protection | **SOURCE-APPLIED / LOCKED**. The former pending trigger SQL has been ported into tracked migration `supabase/migrations/20260728054727_d60fa5e6-df66-4794-984d-39a024fe5529.sql`. Do not create a duplicate migration. | Live DB trigger/policy verification when read-only DB access is available. |
| 2 | `onboarding_requests` payment/status tampering | **SOURCE-APPLIED / LOCKED** in the same tracked migration. | Live DB trigger verification + denial test as creator/authenticated non-admin. |
| 3 | `billing_orders` amount/status client mutation | **LOCKED pending regression evidence**. Existing security memory records trigger-enforced trusted-field protection. | Re-run current billing security tests against live DB; do not create new migration unless trigger protection is missing or weakened. |
| 4 | `studio_vault_products` internal cost-price exposure | **Needs current verification**. Historical report says revoked; no new source change justified without evidence. | Current RLS/grant test. |
| 5 | Bank/IFSC/UPI PII read scope | **Needs current verification**. | Current RLS test as creator/buyer/unrelated authenticated user. |
| 6 | Signed storage URLs in public settings | **Needs current verification**. | Inspect current `site_config` / `platform_settings` policies and representative rows with secrets redacted. |
| 7 | DMCA/onboarding PII exposure | **Needs current verification**. | RLS denial tests across unrelated authenticated users and anonymous access. |
| 8 | Internal review notes visible to creators | **Needs current verification**. | Creator-vs-admin RLS tests for current review-note/admin-only surfaces. |
| 9 | Cross-workspace leakage in `revenue_lines` | **Open until runtime policy proof exists**. UI workspace filtering is not a replacement for database workspace isolation. | Two-workspace authenticated RLS test; only then decide whether a migration is required. |
| 10 | Broad EXECUTE on `SECURITY DEFINER` functions | **Strong source test coverage already exists; preserve it**. `tests/security/security_definer_privileges.sql` scans every public SECURITY DEFINER function and tests anon/authenticated/service-role expectations. | Execute the existing suite against the current live schema. If it reports residual grants, patch only those functions/grants. |

## Existing security test asset — locked for reuse

`tests/security/security_definer_privileges.sql` is the canonical privilege test for Phase 1 item #10. It already:

- enumerates every `public` SECURITY DEFINER function;
- allows anon EXECUTE only for the explicit screening viewer functions;
- distinguishes service-only trigger/internal functions;
- asserts anon denial on high-risk admin, role, storage, invoice and Razorpay helpers;
- checks authenticated callers remain gated by in-function authorization;
- checks service-role execution paths;
- runs in a transaction and rolls back.

Do not replace this suite with a second parallel security-definer test file. Extend the allow/service lists only if the current live schema proves they are stale.

## Completed-work lock implications

Do **not** recreate or re-run these as new migrations solely because old scanner reports mention them:

- Batch 2 quarantine migration.
- Batch 2 / 2b production filter wiring.
- Batch A QC gating/workspace filtering contract.
- Onboarding / hard-disk field-lock trigger migration already tracked in `supabase/migrations/20260728054727_d60fa5e6-df66-4794-984d-39a024fe5529.sql`.

## Current blocker

This ChatGPT connector currently lacks read-only access to project `hllgmkfqgeuqlmpcirvn`, so Phase 1 can establish and preserve the source baseline but cannot honestly mark DB/RLS items 1–10 as runtime verified from this environment.

Do not substitute UI behavior or historical scanner text for current database policy evidence.

## Phase 1 execution rule

For each unverified item:

1. Reproduce/inspect current live state read-only.
2. Reuse existing migration/test if already present.
3. Create a new migration only when a current live gap is proven.
4. Keep the migration in `supabase/migrations-pending/` with rollback.
5. Request Founder approval for that exact migration before execution.
6. Re-run focused security tests after execution.

## Current decision

Phase 1 is **IN PROGRESS — source baseline locked, live DB verification pending**.

No P0 migration is approved or executed by this checkpoint.
