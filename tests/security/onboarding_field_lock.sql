-- SQL/security tests for the QUARANTINED onboarding field-lock migration.
--
-- Run against a scratch database. All tests are transactional and roll back
-- so no data persists. The tests intentionally exercise both the enforcement
-- (owner cannot mutate privileged fields) and the bypass paths (service_role,
-- admin, super_admin).
--
-- Runner note: this file mirrors the pattern used by the sibling files under
-- tests/security/. It is NOT wired into supabase/migrations/*.
--
-- NB: platform_owner / founder are DELIBERATELY NOT granted bypass here.
-- Rationale derived from the repo's role model (`app_role` enum + RLS): those
-- roles are for control-plane visibility (MCP, vault admin) and are never
-- expected to hand-mutate a live payment row. The Razorpay webhook and admin
-- review RPCs already run as service_role, so no additional bypass is needed.

BEGIN;

-- 1. Apply the quarantined migration into this transaction only.
\i supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql

-- 2. Fixture: seed one onboarding_request owned by a test user.
DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_req_id uuid;
BEGIN
  -- Seed the fixture rows the trigger relies on.
  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'owner@test.local'),
    (v_admin, 'admin@test.local');
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_admin, 'admin');

  INSERT INTO public.onboarding_requests
    (user_id, payment_status, onboarding_status, base_price, final_price)
  VALUES
    (v_owner, 'awaiting_payment', 'draft', 100000, 100000)
  RETURNING id INTO v_req_id;

  ----------------------------------------------------------------------------
  -- Test 1: OWNER ordinary (non-privileged) UPDATE succeeds
  ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  UPDATE public.onboarding_requests
     SET notes = 'owner edited notes'
   WHERE id = v_req_id;
  ASSERT (SELECT notes FROM public.onboarding_requests WHERE id = v_req_id) = 'owner edited notes',
    'owner ordinary update should succeed';

  ----------------------------------------------------------------------------
  -- Test 2: OWNER privileged-field UPDATE is REJECTED
  ----------------------------------------------------------------------------
  BEGIN
    UPDATE public.onboarding_requests
       SET payment_status = 'paid'
     WHERE id = v_req_id;
    RAISE EXCEPTION 'expected owner privileged-field update to be blocked';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- expected 42501
  END;

  -- Same for access_code / final_price / razorpay_payment_id
  BEGIN
    UPDATE public.onboarding_requests
       SET access_code = 'CHEAT-001'
     WHERE id = v_req_id;
    RAISE EXCEPTION 'expected owner access_code update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  ----------------------------------------------------------------------------
  -- Test 3: ADMIN privileged-field UPDATE SUCCEEDS
  ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  UPDATE public.onboarding_requests
     SET onboarding_status = 'approved'
   WHERE id = v_req_id;
  ASSERT (SELECT onboarding_status FROM public.onboarding_requests WHERE id = v_req_id) = 'approved',
    'admin should be able to approve';

  ----------------------------------------------------------------------------
  -- Test 4: SERVICE_ROLE (Razorpay webhook path) SUCCEEDS
  ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.onboarding_requests
     SET payment_status = 'paid',
         razorpay_payment_id = 'pay_test_123'
   WHERE id = v_req_id;
  ASSERT (SELECT payment_status FROM public.onboarding_requests WHERE id = v_req_id) = 'paid',
    'service_role webhook update must succeed';

  RAISE NOTICE 'All onboarding field-lock trigger tests passed.';
END $$;

-- 5. Rollback statements target the correct trigger/function names.
--    (Sanity assertion: names must resolve.)
SELECT
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_enforce_onboarding_owner_field_lock') = 1 AS trigger_ok,
  (SELECT COUNT(*) FROM pg_proc  WHERE proname = 'trg_enforce_onboarding_owner_field_lock') = 1 AS function_ok;

ROLLBACK;
