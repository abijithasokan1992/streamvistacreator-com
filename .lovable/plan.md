# Cheap Cleanup Batch (source-only, low risk)

Four small, independent edits. No DB migrations, no deploys, no business logic changes.

## 1. Delete SmartUploads dead code (PR-A)
- Delete `src/pages/SmartUploads.tsx`
- Delete `src/components/uploads/SmartDropUploader.tsx`
- Remove the stale commented import in `src/App.tsx:79`:
  ```
  // import SmartUploads from "./pages/SmartUploads.tsx";
  ```
Confirmed via grep: no active route or import references either file.

## 2. Fix title_edit_requests tab drift (P2 #10 — corrected target)
**Correction to previous ledger**: the filter drift is not in `TitleInspectionDrawer.tsx` (that component doesn't query `title_edit_requests` at all). It's in `src/components/admin/TitleEditRequestsInbox.tsx`:

- The `Req.status` union type is `"open" | "approved" | "rejected" | "closed"` — missing `fulfilled` and `cancelled` which are valid DB enum values.
- The tab state union `"open" | "approved" | "rejected" | "all"` is missing `fulfilled` and `cancelled`, so those rows are invisible under any tab except "all".

Changes:
- Extend the `Req.status` type union to include `"fulfilled" | "cancelled"`.
- Extend the tab state union and add two `<TabsTrigger>` entries: **Fulfilled**, **Cancelled**.
- No query changes needed — the `.eq("status", tab)` filter already handles any string value.

## 3. Remove stale commented import (P3 #16)
Covered by step 1 (same line in `src/App.tsx`).

## 4. /checkout/storage analytics event (P2 #11)
In `src/pages/CheckoutStorage.tsx`, fire a one-shot analytics event on mount so we can measure legacy-link traffic before eventual removal:

- Add a `useEffect` that logs a `legacy_checkout_storage_visit` event via the existing telemetry helper (`src/lib/paymentTelemetry.ts` — reuse; no new dep).
- Include `referrer` and `search` params in the payload.
- Fire once per mount, no PII.

## Verification steps after edits
1. `tsgo` typecheck — must pass.
2. Run existing smoke tests (`bunx vitest run`) — nothing should regress; SmartUploads has no dedicated tests.
3. Manual: open `/checkout/storage` in preview → confirm telemetry call in Network tab and existing redirect still works.

## Out of scope (explicitly deferred)
- SECURITY DEFINER audit (P1 #4)
- Storage_topups reconciliation (P0 #2)
- Pending migration promotion (P0 #1)
- Buyer Mapping list Realtime (P2 #9)
- revenue_transactions admin UI (P2 #8)

## Risk
Very low. All four edits are additive or delete-only, with no schema, RLS, or payment-path changes.
