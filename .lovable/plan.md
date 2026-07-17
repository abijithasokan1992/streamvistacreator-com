# Razorpay Payment Integration Audit (Read-Only)

## 1. Is Razorpay integrated?

**Yes — Razorpay is the active, primary payment provider** for StreamVista, running in live mode. A parallel Paddle scaffold exists (see §6) but is not the primary path.

## 2. Source paths & Edge Functions

**Edge Functions (`supabase/functions/`):**
- `create-razorpay-order` — order creation for onboarding
- `create-razorpay-subscription` — recurring subscriptions
- `verify-razorpay-payment` — client-side handler signature verification
- `razorpay-webhook` — server webhook (signature + ledger idempotency + side-effects)
- `razorpay-webhook-retry` — retries side-effects for prior ledger rows
- `razorpay-admin` — admin ops
- `check-razorpay-status` — live credential/health probe
- `generate-test-razorpay-order`, `simulate-razorpay-verify` — test utilities
- `create-storage-topup` / `verify-storage-topup` — storage add-on flow
- `create-vault-purchase`, `inaugural-activation-pay`, `fastlink-pay`, `charge-overages`, `admin-billing-proof-url`, `payment-telemetry`
- `_shared/razorpay-config.ts`, `_shared/payment-logger.ts`, `_shared/payment-trace.ts`, `_shared/billing-cancel.ts`

**Frontend:**
- `src/lib/payments/initializeCheckout.ts` — unified Razorpay checkout opener
- `src/lib/payments/checkoutHostGuard.ts`, `billingFailure.ts`
- `src/components/payments/GlobalPaymentProvider.tsx` — app-wide opener
- `src/lib/paymentTelemetry.ts`

**Database (from `<supabase-tables>`):** `billing_orders`, `billing_payment_attempts`, `billing_ledger_events`, `razorpay_config`, `razorpay_audit_log`, `razorpay_webhook_ledger`, `payment_debug_logs`, `payment_traces`, `storage_topups`, `subscriptions`, `invoices`, `manual_invoices`, `billing_manual_payment_submissions`, `fastlink_payments`.

## 3. Environment variable NAMES (values NOT shown)

Razorpay (active): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` — read from edge-function secrets; `razorpay_config` DB row may hold non-sensitive `key_id`/`mode` for admin display only, per `_shared/razorpay-config.ts`.

Paddle (scaffold only): `PADDLE_API_KEY`, `PADDLE_ENVIRONMENT`, `PADDLE_LIVE_API_KEY`, `PADDLE_SANDBOX_API_KEY`, `PADDLE_WEBHOOK_SECRET`.

## 4. Payment purposes covered

- **Customer collection**: onboarding activation (`create-razorpay-order` → `onboarding_requests`), storage top-ups (`create-storage-topup`), vault purchases (`create-vault-purchase`), FastLink one-off pay (`fastlink-pay`), inaugural activation (`inaugural-activation-pay`), overage charges (`charge-overages`).
- **Subscription**: `create-razorpay-subscription` → `subscriptions` table.
- **Invoices**: HTML tax invoices auto-emailed on webhook success; ledger in `invoices` / `manual_invoices`.
- **Creator payout**: `deal_payouts`, `partner_statements`, `settlements`, `royalty_*` tables exist — but no Razorpay **Payouts / RazorpayX** integration code was found. Payouts are tracked/settled internally, not disbursed via Razorpay API.

## 5. Controls in place

- **Order creation** (`create-razorpay-order`): auth-gated (Bearer JWT), ownership check against `onboarding_requests.submitter_user_id`, server-computed authoritative price via `computeFinalPricePaise`, idempotent (returns existing `razorpay_order_id` if set), logs to `payment_debug_logs`.
- **Signature verification**:
  - `verify-razorpay-payment`: HMAC-SHA256 over `order_id|payment_id` with `RAZORPAY_KEY_SECRET` via `node:crypto createHmac`.
  - `razorpay-webhook`: HMAC-SHA256 over raw body with `RAZORPAY_WEBHOOK_SECRET`, compared with `timingSafeEqual`. Invalid signature → 400 and ERROR log.
- **Webhook idempotency**: `razorpay_webhook_ledger` keyed on `event_id` (from `x-razorpay-event-id`), short-circuit before side-effects; `email_send_log` idempotency keys (`rzp-invoice-buyer-…`, `rzp-invoice-admin-…`, `rzp-orphan-…`) guard email replays.
- **Refunds**: handled inbound only — `refund.processed` webhook updates `billing_orders.status='refunded'` and `storage_topups.payment_status='refunded'`; refunded rows are never regressed. No outbound refund API call code.
- **Payouts**: no Razorpay Payouts/RazorpayX code. Internal ledger only.
- **Audit logging**: `payment_debug_logs` (structured, action_type-keyed), `razorpay_audit_log`, `razorpay_webhook_ledger`, `payment_traces` (via `payment_trace_upsert` RPC), `admin_audit_log`, `mcp_audit_log`.
- **DB triggers referenced elsewhere**: `trg_enforce_billing_orders_paid_guard` (service_role-only `paid` transition), server-side amount validation on `billing_orders`.

## 6. Legacy code

- **Django / PythonAnywhere / `films_payment`**: **no references found** anywhere in the repo (`rg` returned zero hits for all three). Classified **absent**.
- **Paddle**: a full scaffold exists — `server/` Node/Express service, `supabase/functions/paddle-portal`, `supabase/functions/payments-webhook`, `supabase/functions/_shared/paddle.ts`, `_shared/paddleAccess.ts`, `src/lib/paddle.ts`, `src/hooks/usePaddleCheckout.ts`, `paddle_customers` table. Not the production path; some pages (`Refund`, `Terms`, `CheckoutStorage`, `PaymentTestModeBanner`) still reference Paddle-era strings.

## Classification

| Component | Status |
|---|---|
| `create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook` (+ retry) | **Current** |
| `razorpay_webhook_ledger` idempotency, `_shared/razorpay-config.ts`, `_shared/payment-logger.ts`, `_shared/payment-trace.ts` | **Current** |
| `initializeCheckout.ts` + `GlobalPaymentProvider.tsx` | **Current** |
| `create-storage-topup` / `verify-storage-topup`, `create-vault-purchase`, `create-razorpay-subscription`, `charge-overages`, `fastlink-pay`, `inaugural-activation-pay` | **Current** |
| `check-razorpay-status`, `razorpay-admin`, `payment-telemetry`, `admin-billing-proof-url` | **Current** (operational) |
| `generate-test-razorpay-order`, `simulate-razorpay-verify` | **Current — test utilities**; verify not exposed in production (naming implies dev-only). |
| Refund handling (inbound webhook only) | **Current but partial** — no outbound refund API. Worth reimplementing if merchant-initiated refunds are required. |
| Razorpay Payouts / RazorpayX for creator disbursement | **Absent** — internal ledger only. Reimplement if platform is to disburse via Razorpay. |
| Paddle scaffold (`server/`, `paddle-portal`, `payments-webhook`, `src/lib/paddle.ts`, `usePaddleCheckout.ts`, `paddle_customers`, Paddle env vars) | **Legacy-compatible / unsafe if left half-wired** — no evidence it's driving live traffic, but env vars, `PaymentTestModeBanner`, and public policy pages still reference it. Recommend explicit decision: fully remove, or freeze behind a feature flag. |
| Django / PythonAnywhere / `films_payment` legacy | **Absent** |

## Residual risks (no code changes proposed here)

- No outbound refund/payout API path — merchant-side refunds are manual via Razorpay Dashboard; reconciliation relies on webhook.
- Dual-provider surface (Paddle scaffold + Razorpay live) risks operator confusion; policy pages mention Paddle.
- `simulate-razorpay-verify` and `generate-test-razorpay-order` should be confirmed disabled/guarded in production; not verified in this audit.
- `razorpay_config` DB row is display-only per code; confirmed secrets are read from env, not DB.

No secret values were read or emitted. No files modified.
