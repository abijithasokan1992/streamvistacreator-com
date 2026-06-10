## 1. Client Review Suite → step-by-step wizard (UX redesign)

`src/pages/Client.tsx` today is a single dense hub with hero + paste-link + 3-up grid + safety strip + upsell — overwhelming for first-time clients. Redesign as a **3-step horizontal wizard** with progress dots and one-at-a-time focus:

- **Step 1 — Welcome.** "You're set up as a Client" + 30-second explainer (Watch · Comment · Approve).
- **Step 2 — Open your first review.** The paste-link panel, isolated, with clear example + helper.
- **Step 3 — How review works.** The 3 feature cards (player / timecoded notes / approval) + safety strip + upgrade hint.

Local state only (`step` 1→3), no DB writes. Each step has Back/Next; final step has "Enter Review Suite" which marks `seen_client_wizard` in localStorage so returning users skip it and land on the existing hub layout (kept as the "post-wizard" view).

Pure presentation — no business-logic changes.

## 2. Creator plan billing — recurring on both gateways

### Database
Single migration:
- Drop & re-add `user_profiles.plan_tier` CHECK to allow `('free','creator','monthly','quarterly','yearly')` (keeps legacy values).
- Add columns to `public.subscriptions`: `gateway text default 'stripe'`, `razorpay_subscription_id text unique`, `razorpay_plan_id text`. Indexes on both.
- New table `public.premium_invitation_redemptions(invitation_id, user_id, redeemed_at)` for audit + idempotency.
- New SECURITY DEFINER trigger on `auth.users` AFTER INSERT: `redeem_premium_invitation_on_signup()` — looks up active `premium_invitations` by lower(email), grants role (creator), bumps `user_profiles.plan_tier='creator'` + storage allowance, marks invitation `redeemed`, inserts redemption log. Idempotent.
- New SECURITY DEFINER function `grant_creator_role(uid uuid)`: deletes `user_roles` row where role='client' for that uid, inserts ('creator') with ON CONFLICT DO NOTHING, updates `user_profiles.plan_tier='creator'`. Called from edge functions via service role.

### Stripe recurring (global cards)
- Create Stripe product+price via the payments tool: `creator_monthly` @ ₹76700 INR, recurring monthly, qty 1–10 (per TB).
- Update `create-checkout/index.ts`: replace stale `ALLOWED_PRICE_IDS` with `{cloudx_creator, creator_monthly}`; add `subscription_data.metadata.userId`; ensure `customer` resolved via `resolveOrCreateCustomer`.
- Update `payments-webhook/index.ts`: on `customer.subscription.created` / `.updated` with status active/trialing, call `grant_creator_role(userId)`. On `.deleted` or `status=canceled`, revert to `client` role + `plan_tier='free'`.

### Razorpay recurring (India)
- New edge function `create-razorpay-subscription`: creates Razorpay Plan (idempotent by id `creator_monthly_inr`) at ₹76700/month if missing, then `subscriptions.create` with `customer_notify=1`, `quantity` = TB count, metadata `{userId, plan:'creator'}`. Returns `subscription_id` + `short_url`. Front-end opens Razorpay Checkout in subscription mode.
- Update `razorpay-webhook/index.ts`: handle `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`. Upsert into `subscriptions` (gateway='razorpay'), set status, call `grant_creator_role` on activate/charge and revoke on cancel/halt.
- Update `MyAccount.tsx` UpgradeSection: replace one-shot Razorpay order call with `create-razorpay-subscription` for the Creator plan; storage top-ups stay on the existing one-shot path.

## 3. Role assignment on payment

Centralized in DB function `grant_creator_role()` above. Both webhooks call it — single source of truth. Removes `client`, adds `creator`, updates `plan_tier`. `RoleGate` and `dashboardForRole` already handle `creator` → `/vault`.

## 4. Premium invitation redemption

DB trigger `redeem_premium_invitation_on_signup` (above) fires inside `handle_new_user_profile`'s chain on `auth.users` insert. For each active, non-expired, non-redeemed invite where `lower(email)=lower(NEW.email)`:
- Mark invite `status='redeemed'`, `redeemed_at=now()`, `redeemed_user_id=NEW.id`.
- Grant role per invite (`creator` by default; `is_free`/`storage_tb` honored).
- Set `user_profiles.plan_tier='creator'`, `topup_tb = greatest(coalesce(topup_tb,0), invite.storage_tb-1)`.
- Insert into `premium_invitation_redemptions` to make replay safe.

No UI changes — entirely server-side.

## 5. Cancellation — explicitly deferred

No self-serve UI built. `SupportRequestForm` continues to be the only path. Add one helper line in `MyAccount.tsx` under Account tab: *"To cancel or change your subscription, please open a support ticket."* + link to existing form.

## Test plan (preview)

1. **Wizard:** clear `localStorage.seen_client_wizard`, sign in as a client → land on `/client` → step through 3 screens → verify final click lands you on the hub view and a refresh keeps you on the hub.
2. **Premium invite:** create a `premium_invitations` row in admin for a test email → sign up with that email → confirm role='creator', plan_tier='creator', invite row status='redeemed'.
3. **Stripe recurring (sandbox card 4242 4242 4242 4242, any future expiry, any CVC):** from `/account` → Upgrade → Card → completes Embedded Checkout → webhook fires → reload `/account`, `user_roles` row has `creator`, redirect to `/vault` works.
4. **Razorpay recurring (Razorpay test card 4111 1111 1111 1111, OTP 1221):** from `/account` → Upgrade → UPI/Card India → subscription created → simulate `subscription.activated` from Razorpay dashboard or trigger via test payment → role upgraded.
5. **Cancellation:** confirm Account tab shows support-ticket copy and no cancel button exists.

## Files changed (high level)
- `src/pages/Client.tsx` — wizard refactor (presentation only).
- `supabase/migrations/<new>.sql` — plan_tier constraint, subscriptions columns, redemption log, trigger, `grant_creator_role`.
- `supabase/functions/create-checkout/index.ts` — allow creator price + subscription metadata.
- `supabase/functions/payments-webhook/index.ts` — role grant/revoke on subscription events.
- `supabase/functions/create-razorpay-subscription/index.ts` — new.
- `supabase/functions/razorpay-webhook/index.ts` — subscription event handlers + role grant.
- `src/components/dashboard/MyAccount.tsx` — call new Razorpay subscription fn; add support-only cancellation copy.
- `src/integrations/supabase/client.ts` — untouched (auto-gen).
