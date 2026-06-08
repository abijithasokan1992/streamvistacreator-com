# E2E Referral Flow Test

Reproduces the full viral-loop on every deployment:

1. Referrer signs up → gets a `referral_codes.code`
2. Fresh ("incognito") client signs up as referee
3. Referee calls `attach_referral` RPC (same path as `ReferralCapture.tsx`)
4. Admin client approves the row with a reward
5. Referrer sees the approved reward (what `ReferralRewards.tsx` reads)
6. Self-referral is rejected

## Run locally

```bash
export E2E_ADMIN_EMAIL="admin@yourdomain.com"
export E2E_ADMIN_PASSWORD="…"
node scripts/e2e-referral.mjs
```

Optional env: `E2E_EMAIL_DOMAIN` (default `e2e.test`),
`E2E_REWARD_TYPE` (`storage`|`revenue`), `E2E_REWARD_AMOUNT`.

Exits non-zero on any failure.

## Run on every deployment

GitHub Actions example (`.github/workflows/e2e-referral.yml`):

```yaml
name: e2e-referral
on:
  deployment_status:
  workflow_dispatch:
jobs:
  run:
    if: github.event.deployment_status.state == 'success' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - env:
          E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
        run: node scripts/e2e-referral.mjs
```

## Notes

- Requires email-confirmation **disabled** in Lovable Cloud auth settings
  (or pre-confirmed test domains), otherwise sign-up sessions won't be issued.
- The admin account must already exist and have the `admin` role in `user_roles`.
- Each run creates two throwaway auth users; periodically prune them
  (`auth.users` where email like `e2e-%@e2e.test`).
