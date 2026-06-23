# Ticket: Standardize storage-purchase failure contract

**Status:** Open · follow-up to accepted P0 cross-dashboard billing hotfix
**Priority:** P1 (cleanup, not blocking)
**Owner:** unassigned

## Context

The P0 hotfix wired real error surfacing + `support_requests` billing-failure
logging into three surfaces:

- Studio · `BuyVaultDialog` (`studio_buy_vault_dialog`)
- Creator · `StorageUsageCard` (`creator_storage_topup_card`)
- Creator · `Upgrade` subscription (`creator_upgrade_subscription`)

Shared utilities already exist in `src/lib/payments/billingFailure.ts`:
- `extractFnError(error, fallback)`
- `reportBillingFailure({ dashboard, surface, stage, intent, error, extra })`

That contract is NOT yet enforced on every other storage / vault purchase
entry point, and copy for the three canonical failure modes is inconsistent.

## Goal

One failure contract for every current and future storage purchase surface
(Creator, Studio, and any new vault buy entry point).

## Scope of work

1. **Inventory** every surface that can trigger a storage / vault purchase
   or top-up. At minimum: shared `Buy1TBCard`, Creator `DeliveryVault`
   purchase card, Creator `Home` action row, Studio `OneClickBuyCard`,
   Studio "Buy Storage" tab, and any admin-initiated purchase path.

2. **Standardize the 3 failure modes** with one shared copy + toast helper:
   - `SKU unavailable` — live SKU could not be resolved (e.g. deactivated,
     RLS hides row). Today: ad-hoc strings ("Studio storage product is not
     available right now.", silent no-op, disabled button).
   - `Order create failed` — `create-vault-purchase` / `create-storage-topup`
     returned non-2xx or `{ error }`. Today: surface-specific copy.
   - `Verify failed` — `verify-storage-topup` returned non-ok / signature
     mismatch / projection error. Today: surface-specific copy.

3. **Enforce `reportBillingFailure` on every path** with the canonical
   `BillingStage` value (`sku_resolution` | `dialog_launch` | `order_create`
   | `payment_verify` | `allocation_refresh`) and a stable `surface` id per
   entry point. No surface should silently swallow a failure.

4. **Add a tiny wrapper** (e.g. `useStoragePurchase({ dashboard, surface, intent })`)
   so future buy surfaces get the contract by construction instead of by
   copy-paste.

5. **Admin side** — confirm the existing Support inbox renders
   `request_type = "billing_failure"` rows with the new metadata fields
   (`dashboard_type`, `surface`, `billing_stage`, `purchase_intent`,
   `error_message`, Razorpay ids). Add a filter chip if it isn't already
   trivial to triage.

## Explicitly out of scope

- No changes to edge functions (`create-vault-purchase`,
  `create-storage-topup`, `verify-storage-topup`).
- No schema split for storage accounting.
- No new SKUs; the live 1 TB Studio Storage SKU remains the only product.
- No redesign of Creator / Studio / Admin shells.

## Acceptance criteria

- Every storage / vault purchase button in the app routes failures through
  `extractFnError` + `reportBillingFailure` with a unique `surface` id.
- The three failure modes use identical user-facing copy across Creator and
  Studio.
- Admin Support inbox can filter to `billing_failure` and shows
  dashboard / surface / stage / intent without opening the row.
- No surface displays the raw "Edge Function returned a non-2xx status code"
  string under any failure mode.
