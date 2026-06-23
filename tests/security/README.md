# SECURITY DEFINER test suite

Automated checks that every `SECURITY DEFINER` function in the `public`
schema has the right EXECUTE privileges and that the critical RPCs
actually gate by role inside their bodies.

## What it covers

1. **Privilege smoke (every function, ~120 × 3 assertions)**
   - `anon` EXECUTE matches policy (denied except the two public
     screening-viewer functions `screening_resolve`, `screening_log_event`).
   - `authenticated` EXECUTE is granted on user-facing RPCs and revoked on
     trigger / service-only functions.
   - `service_role` EXECUTE is granted on all SECURITY DEFINER functions.

2. **Behavioral tests on critical functions**
   - `anon` is denied on admin RPCs, role helpers, sweeps, and razorpay
     secret validators (negative test).
   - `anon` IS allowed to call the public screening surface without an
     `insufficient_privilege` error (positive test).
   - `authenticated` without a valid `auth.uid()` is still rejected by the
     in-body authorization check on admin RPCs (proves grants alone don't
     bypass gating).
   - `authenticated` CAN call read-only role helpers (`has_role`,
     `is_super_admin`, `is_workspace_*`).
   - `service_role` never trips `42501` on the calls edge functions make.

## Running

```bash
# with PG* env vars already set (Lovable sandbox default):
bash tests/security/run.sh

# or against any other DB:
DATABASE_URL='postgres://...' bash tests/security/run.sh
```

The suite runs inside a single transaction that is rolled back at the
end — it never mutates the database. Exit code is non-zero on any
failed assertion, with a list of failing assertion names printed.

## Updating the policy lists

Two `TEMP TABLE`s at the top of `security_definer_privileges.sql`
encode policy and must be updated when intent changes:

- `_anon_allowed` — function names that anon is intentionally allowed to
  execute. Add a new entry only when you've reviewed the function and
  confirmed it's safe for unauthenticated callers.
- `_service_only` — function names that are triggers or are only invoked
  by `service_role` / internal cron. `authenticated` is expected NOT to
  have EXECUTE on these.

If you add a new SECURITY DEFINER function, the privilege smoke will
fail until you (a) grant the right privileges in a migration AND
(b) update these lists if the new function is anon-public or
service-only.
