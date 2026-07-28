# Plain-Language Relabel — Admin, Finance & Payments

**Scope:** UI copy only. No changes to business logic, payment processing, DB columns, RLS/permissions, migrations, or deployments.

## Approach

**Single source of truth:** `src/lib/copy/adminLabels.ts`
- Exports `ADMIN_LABELS` (all label swaps from the mapping table)
- Exports `paymentStatusLabel(status: string): { label, tone, hint }` covering: Payment Successful, Payment Failed, Payment Started, Payment Window Closed, Payment Confirmation Pending, Refund Started, Refund Completed, Website Not Approved for Payment.
- Exports `RAZORPAY_BANNER_COPY` (heading, current-websites block, status paragraph — verbatim from user's message).
- Exports `SITE_ROLE_LABELS` (Official App & Payment Website / Main Registered Website / Website Registered with Razorpay / Test Website / Website Currently Open).

**Reusable disclosure:** `src/components/admin/TechnicalDetailsDisclosure.tsx`
- shadcn `Collapsible` + `Button` labelled **"View Technical Details"**.
- Props: `entries: { label: string; value: ReactNode; mono?: boolean }[]`, optional `testRecord?: boolean` badge, optional `title`.
- Hides by default: `order_id`, `payment_id`, `topup_id`, `user_id`, callback/webhook/browser origin, synthetic verify, raw event names (`payment.captured`, etc.), raw error codes (`BAD_REQUEST_ERROR`), internal identifiers (`studio_vault`), `admin.test` synthetic records.
- Visible row-level fields kept outside disclosure: Customer, Amount, Date, Payment Status, Recommended Action.

## Batches (typecheck after each)

**Batch 1 — Foundation**
- Create `src/lib/copy/adminLabels.ts`.
- Create `src/components/admin/TechnicalDetailsDisclosure.tsx`.

**Batch 2 — Admin shell & Quick Actions**
- `src/pages/Admin.tsx`, `src/pages/AdminHome.tsx`, `src/pages/admin/MediaOffice.tsx`
- `src/components/admin/QuickActions.tsx`, `AdminCommandBar.tsx`, `AdminRunbook.tsx`
- Swaps: Execute Global Maintenance → Run System Check; Approve Title → Review & Approve Content; Publish Title → Release Content; Trigger Payout → Send Partner Payments; Restart Ingest Pipeline → Retry Failed Uploads; Admin Override → Manual Admin Approval; Audit Log → Activity History.

**Batch 3 — QC & Legal**
- `src/components/admin/QCLegalValidationSurface.tsx`, `TitleReviewPanel.tsx` (if labels present).
- Swaps: QC Queue → Content Quality Review; Legal Queue → Rights & Legal Review; Operational QC validation panel → Review technical quality; Operational legal clearance panel → Review rights and legal documents; Requeue failed uploads → Retry failed uploads; Reprocess the ingest queue → Process upload again.

**Batch 4 — Finance & Payments**
- `src/components/admin/BillingOperations.tsx`, `AdminFinanceConsole.tsx`, `FinanceExtensionHub.tsx`, `CommercialControlTower.tsx`
- `src/components/admin/RevenueStatementImport.tsx`, `ManualInvoiceConsole.tsx`, `ManualInvoicesList.tsx`, `PaymentTrace.tsx`, `RazorpayAuditLog.tsx`, `RazorpayOpsBanner.tsx`, `RazorpayCredentials.tsx`
- `src/components/admin/AdminStudioVaultPurchases.tsx` → Purchased Content
- Swaps: Finance Operations → Payments & Finance; Billing Operations → Billing & Payments; Payment traces → Payment History; Revenue Import → Add Revenue Data; Partner Statements → Partner Earnings Reports; Royalty Engine → Revenue Share Calculator; Settlements → Completed Payments; Pending Reviews → Payments Awaiting Review; Founder-assisted Invoices → Custom Quotes & Invoices; Run overdue sweep → Check Overdue Invoices; Payment Trace → Payment Journey; Forensic timeline → Detailed Payment History; Checkout callback → Payment Return Check; Verify → Confirm Payment; Webhook → Automatic Payment Update; Entitlement → Access Granted; Vault Purchases → Purchased Content; Gross revenue → Total Revenue; Net revenue → Revenue After Deductions; Outstanding payouts → Payments Due; Scoped for finance staff → Available to Finance Team; Payment method configuration → Payment Settings; Submitted → Date Submitted; UTR → Bank Reference Number; Synthetic verify → Test Payment Check; Checkout Dismissed → Payment Window Closed; Checkout Open → Payment Started; Verify delayed → Payment Confirmation Pending; Deprecated → No Longer Used; Non-canonical → Test Only.
- `PaymentTrace.tsx`, `RazorpayAuditLog.tsx`, `AdminStudioVaultPurchases.tsx`, `ManualInvoicesList.tsx`: move IDs / raw payloads / event names / signature / error codes / source into `TechnicalDetailsDisclosure`. `admin.test` rows collapsed with badge "Test record".
- `RazorpayOpsBanner.tsx`: rewrite using `RAZORPAY_BANNER_COPY` (Razorpay Website Approval Pending heading, four current-websites cards using SITE_ROLE_LABELS, Current Status paragraph).

**Batch 5 — Intelligence**
- `src/components/admin/IntelligenceCenter.tsx`, `BusinessIntelligenceHub.tsx`, `src/pages/AdminResearch.tsx`
- Swaps: Market Intelligence → Market Insights; Business Intelligence → Business Reports.

**Batch 6 — Buyer Marketplace**
- `src/components/streamvista/BuyerEntry.tsx`, `src/components/buyer/marketplace/*` where labels appear.
- Swaps: Marketplace Catalog / Buyer Surface → Content Marketplace; Business Estimates & Pricing Calculator → Pricing Calculator; Vault Purchases → Purchased Content (buyer-facing tabs).

**Batch 7 — i18n**
- `src/i18n/locales/en.json` and `src/i18n/locales/ml.json`: only update keys whose current value matches an old label from the mapping. Do not add new keys unless a hardcoded string is being migrated to i18n as part of a swap already required above (avoided by default — hardcoded strings will use `ADMIN_LABELS` constants instead).

## Intentionally retained technical terms
Kept inside `TechnicalDetailsDisclosure` panels for developer support: `order_id`, `payment_id`, `topup_id`, `user_id`, `callback`, `webhook`, `browser origin`, `synthetic verify`, event names (`payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `subscription.*`, `admin.test`, `verify.payment`), raw error codes (`BAD_REQUEST_ERROR`), internal identifiers (`studio_vault`). These stay because they are the only strings that identify a payment record when contacting Razorpay support.

Also retained (not user-visible): DB columns, RPC names, edge function names, MCP tool names, route paths.

## Verification
- `tsgo` typecheck after each batch.
- Playwright screenshots at 1280×1800 of `/admin`, `/admin/finance`, `/admin/media-office`, `/studio/vault` — confirm new wording and that technical panels are collapsed by default.
- `rg` sweep to confirm no user-visible occurrence of the old terms remains outside `TechnicalDetailsDisclosure` content, `types.ts`, tests, and backend code.

## Final report will include
Files changed, labels replaced (mapping used), typecheck output, screenshots, list of intentionally retained technical terms, and explicit confirmation that no logic / DB / permissions / migrations / deployment / production data were touched.
