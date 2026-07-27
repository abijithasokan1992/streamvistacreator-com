# PR-C: Storage Topups Reconciler (Gate 1 approved — 15 rows)

You approved option **1**: mark all 15 pending `storage_topups` as failed. Building the reconciler + admin UI now, within the exact scope of the earlier proposal. Kill switch stays untouched. No changes to `create-storage-topup` / `verify-storage-topup` runtime paths.

## 1. New edge function: `reconcile-storage-topups`

Location: `supabase/functions/reconcile-storage-topups/index.ts`

- Auth: requires JWT + `has_role(auth.uid(), 'admin' | 'super_admin' | 'platform_owner' | 'founder')`. 403 otherwise.
- Input: `{ actions: [{ topup_id: string, action: 'mark_paid' | 'mark_failed' | 'cancel', reason: string }] }`. `reason` required (min 5 chars). Zod-validated.
- Per row:
  - `mark_failed` / `cancel`: uses service-role client to `UPDATE storage_topups SET status='failed' | 'cancelled', reconciled_at=now(), reconciled_by=auth.uid()` **only when current status ∈ ('created','pending')** (guard against races).
  - `mark_paid`: re-fetches the Razorpay order; only proceeds when `status='paid'` and `amount_paid` matches DB amount. On match, calls the same internal credit routine used by `verify-storage-topup` (extracted into a shared helper) so quota accrual is identical to normal flow. Any mismatch → 409, no write.
- Every action writes one row to `admin_audit_log` with `actor_user_id`, `action`, `target_table='storage_topups'`, `target_id`, `reason`, `before`, `after`.
- CORS headers on every response, including errors.
- Returns per-row `{ topup_id, status: 'ok' | 'skipped' | 'error', message }`.

## 2. Admin UI panel

Location: new component `src/components/admin/StorageTopupsReconciler.tsx`, mounted in the Accounts room of `/admin/office` behind an existing admin role gate.

- Table of `storage_topups` where `status ∈ ('created','pending')` older than 24h.
- Columns: topup id (short), user, amount, created, razorpay_order_id, current status.
- Per-row action dropdown (`mark_failed` default, `cancel`, `mark_paid`) + required reason textarea + confirm button.
- Bulk "Mark all failed" with a single shared reason (for the 15 approved rows).
- On submit: calls `supabase.functions.invoke('reconcile-storage-topups', ...)`, disables the row while in-flight, shows per-row result toast.
- Uses `useModalSubmissionLifecycle` to prevent double-submit.
- No changes to checkout/topup creation UI.

## 3. Tests

- `src/test/smoke/reconcile-storage-topups.test.ts`: role gate rejects non-admins; validates payload shape; asserts `mark_paid` refuses when Razorpay `status!='paid'` or amount mismatches; asserts audit log row is written per action.

## 4. Verification after build

- `tsgo` clean.
- Vitest green for the new smoke test.
- Manual: I will NOT trigger the bulk action; you invoke it from the UI when ready. Then I'll re-run the Gate-1 classification query and confirm 0 pending rows remain.

## Explicitly out of scope
- Revenue RLS migration (still blocked).
- SECURITY DEFINER revoke pass.
- Any change to `create-storage-topup` / `verify-storage-topup`.
- Any user-facing checkout changes.

## Rollback
- Remove the new function directory and UI component; no schema changes to revert. Audit-log rows are additive and safe to keep.
