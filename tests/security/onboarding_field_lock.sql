-- Security tests for QUARANTINED migration:
--   supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql
--
-- Covers both findings:
--   1. onboarding_requests owner-side field lock
--   2. hard_disk_intakes admin_notes lock
--
-- Transactional: rolls back. NB: platform_owner / founder are DELIBERATELY
-- NOT granted bypass here — no server-side workflow requires it, and the
-- Razorpay webhook + admin review RPCs run as service_role.

BEGIN;

\i supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql

DO $$
DECLARE
  v_owner  uuid := gen_random_uuid();
  v_admin  uuid := gen_random_uuid();
  v_req_id uuid;
  v_hd_id  uuid;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'owner@test.local'),
    (v_admin, 'admin@test.local');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_admin, 'admin');

  INSERT INTO public.onboarding_requests
    (client_name, professional_role, selected_cycle, base_price, final_price,
     submitter_user_id, payment_status, onboarding_status)
  VALUES
    ('Owner Test', 'Creator', 'creator', 650, 650, v_owner, 'pending', 'pending')
  RETURNING id INTO v_req_id;

  INSERT INTO public.hard_disk_intakes (user_id, drive_label, admin_notes)
  VALUES (v_owner, 'DRIVE-A', 'internal admin note')
  RETURNING id INTO v_hd_id;

  --------------------------------------------------------------------------
  -- Owner context
  --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Test 1: ordinary profile field update succeeds
  UPDATE public.onboarding_requests SET contact_phone = '+911234567890' WHERE id = v_req_id;
  ASSERT (SELECT contact_phone FROM public.onboarding_requests WHERE id = v_req_id) = '+911234567890',
    'owner ordinary update should succeed';

  -- Test 2: cannot forge payment_status=paid
  BEGIN
    UPDATE public.onboarding_requests SET payment_status = 'paid' WHERE id = v_req_id;
    RAISE EXCEPTION 'expected payment_status update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Test 3: cannot self-approve
  BEGIN
    UPDATE public.onboarding_requests SET onboarding_status = 'approved' WHERE id = v_req_id;
    RAISE EXCEPTION 'expected onboarding_status update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Test 4: cannot change price or promo
  BEGIN
    UPDATE public.onboarding_requests SET final_price = 1 WHERE id = v_req_id;
    RAISE EXCEPTION 'expected final_price update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.onboarding_requests SET promo_code = 'INDUSTRY100' WHERE id = v_req_id;
    RAISE EXCEPTION 'expected promo_code update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.onboarding_requests SET access_code = 'CHEAT' WHERE id = v_req_id;
    RAISE EXCEPTION 'expected access_code update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Test 5: cannot overwrite admin_notes on hard_disk_intakes
  BEGIN
    UPDATE public.hard_disk_intakes SET admin_notes = 'owner injected' WHERE id = v_hd_id;
    RAISE EXCEPTION 'expected admin_notes update to be blocked';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  --------------------------------------------------------------------------
  -- Admin context — protected updates succeed
  --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  UPDATE public.onboarding_requests SET onboarding_status = 'approved' WHERE id = v_req_id;
  ASSERT (SELECT onboarding_status FROM public.onboarding_requests WHERE id = v_req_id) = 'approved',
    'admin should be able to approve';
  UPDATE public.hard_disk_intakes SET admin_notes = 'admin updated' WHERE id = v_hd_id;
  ASSERT (SELECT admin_notes FROM public.hard_disk_intakes WHERE id = v_hd_id) = 'admin updated',
    'admin should be able to edit admin_notes';

  --------------------------------------------------------------------------
  -- service_role (Razorpay webhook) — payment verification succeeds
  --------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', NULL, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.onboarding_requests
     SET payment_status = 'paid', razorpay_payment_id = 'pay_test_123'
   WHERE id = v_req_id;
  ASSERT (SELECT payment_status FROM public.onboarding_requests WHERE id = v_req_id) = 'paid',
    'service_role webhook update must succeed';

  RAISE NOTICE 'All field-lock trigger tests passed.';
END $$;

-- Rollback sanity: trigger & function names resolve
SELECT
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_enforce_onboarding_owner_field_lock') = 1 AS ob_trigger_ok,
  (SELECT COUNT(*) FROM pg_proc    WHERE proname = 'trg_enforce_onboarding_owner_field_lock') = 1 AS ob_function_ok,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'trg_enforce_hard_disk_intakes_admin_notes_lock') = 1 AS hd_trigger_ok,
  (SELECT COUNT(*) FROM pg_proc    WHERE proname = 'trg_enforce_hard_disk_intakes_admin_notes_lock') = 1 AS hd_function_ok;

ROLLBACK;
