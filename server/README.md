# Paddle Fulfillment & Portal Server

Standalone Node/Express service implementing:

1. **`POST /api/webhooks/paddle`** — signature-verified via
   `paddle.webhooks.unmarshal(rawBody, PADDLE_WEBHOOK_SECRET, signature)`.
   Uses `express.raw({ type: 'application/json' })` so the raw payload is
   passed to the SDK exactly as signed. Verification failures return `401`
   so Paddle retries.
2. **Postgres mirror** — `customers` and `subscriptions` tables kept in
   sync idempotently through `ON CONFLICT` upserts inside a transaction.
   Handled events: `subscription.created`, `subscription.updated`,
   `subscription.canceled`, `customer.created`, `customer.updated`,
   `transaction.completed`. All others are ignored.
3. **`checkUserPaidAccess(customerId)`** (`src/entitlements.js`) — treats
   `active` and `trialing` as paid; a pending `scheduled_change_action`
   does not revoke access; only physical statuses `canceled`, `paused`,
   `past_due` deny access.
4. **`GET /api/account/portal`** — resolves the Paddle customer id
   server-side from the authenticated session (never trusts client input),
   calls `paddle.customerPortalSessions.create(customerId, [subscriptionId])`,
   and `res.redirect()`s to the ephemeral Paddle-hosted portal URL.

## Setup

```bash
cp .env.example .env       # fill in PADDLE_* and DATABASE_URL
npm install
npm start
```

Wire `resolveSessionUser` in `src/portal.js` to your real auth layer so
`req.user.paddleCustomerId` (or `req.user.email`) is populated from the
session — the endpoint intentionally refuses to read customer identifiers
from query strings or request bodies.
