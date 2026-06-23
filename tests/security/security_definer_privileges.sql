-- =====================================================================
-- SECURITY DEFINER function privilege & role-gating test suite
-- ---------------------------------------------------------------------
-- Run:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/security/security_definer_privileges.sql
--
-- Exits non-zero on any failed assertion. All tests run inside a single
-- transaction that is rolled back at the end so the database is never
-- mutated.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _test_results(
  name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.t_assert(_name text, _cond boolean, _detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _test_results(name, passed, detail) VALUES (_name, _cond, _detail)
  ON CONFLICT (name) DO UPDATE SET passed = EXCLUDED.passed, detail = EXCLUDED.detail;
  IF NOT _cond THEN
    RAISE WARNING '  ✗ % — %', _name, COALESCE(_detail, '(no detail)');
  END IF;
END $$;

-- Policy: which SECURITY DEFINER functions are intentionally callable by `anon`.
-- Anything not in this set MUST NOT be executable by anon.
CREATE TEMP TABLE _anon_allowed(proname text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _anon_allowed VALUES
  ('screening_resolve'),
  ('screening_log_event');

-- Policy: SECURITY DEFINER functions that are triggers or only invoked
-- internally / by service_role. `authenticated` is NOT expected to have
-- EXECUTE on these.
CREATE TEMP TABLE _service_only(proname text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _service_only VALUES
  ('accept_intro_invite_on_signup'),
  ('assign_default_role'),
  ('audit_site_config_oracle_changes'),
  ('content_titles_lock_guard'),
  ('delete_email'),
  ('enqueue_email'),
  ('handle_new_user_profile'),
  ('intro_invites_block_immutable_updates'),
  ('invoke_edge_function'),
  ('log_onboarding_delete'),
  ('log_onboarding_full_update'),
  ('log_onboarding_status_changes'),
  ('move_to_dlq'),
  ('notify_on_content_approval'),
  ('onboarding_requests_scrub_anon_fields'),
  ('read_email_batch'),
  ('recent_uploads_immutable_guard'),
  ('redeem_premium_invitation_on_signup'),
  ('route_studio_asset'),
  ('title_assets_lock_guard'),
  ('trg_billing_orders_autofulfill'),
  ('trg_billing_sync_storage_topup'),
  ('workspaces_add_owner_member');

-- ---------------------------------------------------------------------
-- 1. Privilege smoke test — EVERY SECURITY DEFINER function in public
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  anon_ok boolean;
  auth_ok boolean;
  svc_ok  boolean;
  expect_anon boolean;
  expect_auth boolean;
  fail_count int := 0;
  total int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
    ORDER BY p.proname, p.oid
  LOOP
    total := total + 1;
    anon_ok := has_function_privilege('anon',          r.oid, 'EXECUTE');
    auth_ok := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    svc_ok  := has_function_privilege('service_role',  r.oid, 'EXECUTE');

    expect_anon := EXISTS (SELECT 1 FROM _anon_allowed WHERE proname = r.proname);
    expect_auth := NOT EXISTS (SELECT 1 FROM _service_only WHERE proname = r.proname);

    PERFORM pg_temp.t_assert(
      format('priv.anon.%s(%s)', r.proname, r.args),
      anon_ok = expect_anon,
      format('expected anon EXECUTE=%s, got %s', expect_anon, anon_ok)
    );
    PERFORM pg_temp.t_assert(
      format('priv.authenticated.%s(%s)', r.proname, r.args),
      auth_ok = expect_auth,
      format('expected authenticated EXECUTE=%s, got %s', expect_auth, auth_ok)
    );
    PERFORM pg_temp.t_assert(
      format('priv.service_role.%s(%s)', r.proname, r.args),
      svc_ok = true,
      format('expected service_role EXECUTE=true, got %s', svc_ok)
    );
  END LOOP;

  SELECT count(*) INTO fail_count FROM _test_results WHERE NOT passed;
  RAISE NOTICE 'Privilege smoke: scanned % SECURITY DEFINER functions, % assertion failures so far',
    total, fail_count;
END $$;

-- ---------------------------------------------------------------------
-- 2. Behavioral tests — critical functions called as anon / authenticated
-- ---------------------------------------------------------------------
-- Helper that runs an arbitrary SQL string as a role and reports whether
-- it raised "permission denied" (or any error). Used for negative tests.
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(_name text, _role text, _sql text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  errmsg text;
  errcode text;
BEGIN
  BEGIN
    EXECUTE format('SET LOCAL ROLE %I', _role);
    EXECUTE _sql;
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.t_assert(_name, false,
      format('expected role %s to be denied, but call succeeded', _role));
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS errmsg = MESSAGE_TEXT, errcode = RETURNED_SQLSTATE;
    EXECUTE 'RESET ROLE';
    -- Acceptable denials: insufficient_privilege (42501) OR an explicit
    -- authorization check inside the function body that raises.
    PERFORM pg_temp.t_assert(_name,
      errcode = '42501'
        OR errmsg ILIKE '%not authorized%'
        OR errmsg ILIKE '%permission denied%'
        OR errmsg ILIKE '%must be admin%'
        OR errmsg ILIKE '%forbidden%'
        OR errmsg ILIKE '%unauthenticated%'
        OR errmsg ILIKE '%not allowed%'
        OR errmsg ILIKE '%auth.uid()%'
        OR errmsg ILIKE '%null value%',   -- auth.uid() IS NULL → constraint violation in many fns
      format('role=%s sqlstate=%s msg=%s', _role, errcode, errmsg));
  END;
END $$;

-- 2a. anon must be DENIED on a representative slice of high-risk RPCs
SELECT pg_temp.expect_denied('behav.anon.is_super_admin',          'anon',
  'SELECT public.is_super_admin(gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.anon.has_role',                'anon',
  'SELECT public.has_role(gen_random_uuid(), ''admin''::app_role)');
SELECT pg_temp.expect_denied('behav.anon.admin_exists',            'anon',
  'SELECT public.admin_exists()');
SELECT pg_temp.expect_denied('behav.anon.admin_review_queue',      'anon',
  'SELECT public.admin_review_queue(NULL)');
SELECT pg_temp.expect_denied('behav.anon.admin_grant_storage',     'anon',
  'SELECT public.admin_grant_storage(gen_random_uuid(), 10, ''t'')');
SELECT pg_temp.expect_denied('behav.anon.admin_adjust_storage',    'anon',
  'SELECT public.admin_adjust_storage(gen_random_uuid(), ''grant''::storage_adjustment_type, 1, ''t'', NULL)');
SELECT pg_temp.expect_denied('behav.anon.admin_provision_creator_plan', 'anon',
  'SELECT public.admin_provision_creator_plan(gen_random_uuid(), NULL, ''basic'', 0, NULL, NULL, NULL)');
SELECT pg_temp.expect_denied('behav.anon.admin_mark_invoice_paid', 'anon',
  'SELECT public.admin_mark_invoice_paid(gen_random_uuid(), NULL, NULL)');
SELECT pg_temp.expect_denied('behav.anon.admin_pending_manual_reviews', 'anon',
  'SELECT public.admin_pending_manual_reviews(10)');
SELECT pg_temp.expect_denied('behav.anon.is_workspace_admin',      'anon',
  'SELECT public.is_workspace_admin(gen_random_uuid(), gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.anon.can_write_workspace',     'anon',
  'SELECT public.can_write_workspace(gen_random_uuid(), gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.anon.create_personal_workspace', 'anon',
  'SELECT public.create_personal_workspace()');
SELECT pg_temp.expect_denied('behav.anon.claim_admin_if_none',     'anon',
  'SELECT public.claim_admin_if_none()');
SELECT pg_temp.expect_denied('behav.anon.grant_creator_role',      'anon',
  'SELECT public.grant_creator_role(gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.anon.revoke_creator_role',     'anon',
  'SELECT public.revoke_creator_role(gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.anon.set_initial_role',        'anon',
  'SELECT public.set_initial_role(''creator'')');
SELECT pg_temp.expect_denied('behav.anon.sweep_manual_invoices_overdue', 'anon',
  'SELECT public.sweep_manual_invoices_overdue()');
SELECT pg_temp.expect_denied('behav.anon.sweep_screening_invites_expired','anon',
  'SELECT public.sweep_screening_invites_expired()');
SELECT pg_temp.expect_denied('behav.anon.validate_razorpay_live_secrets','anon',
  'SELECT public.validate_razorpay_live_secrets(''x'',''y'')');

-- 2b. anon must be ALLOWED on the public screening viewer surface.
--     We expect the call to succeed (no privilege error). It may return
--     NULL / empty rows for a bogus token — that's fine; we only assert
--     that no permission error is raised.
DO $$
DECLARE
  ok boolean := true;
  errmsg text;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.screening_resolve('__test_invalid_token__');
    PERFORM public.screening_log_event('__test_invalid_token__', 'view', 0);
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS errmsg = MESSAGE_TEXT;
    RESET ROLE;
    ok := false;
  WHEN OTHERS THEN
    -- non-privilege errors are acceptable (token not found etc.)
    RESET ROLE;
    ok := true;
  END;
  PERFORM pg_temp.t_assert('behav.anon.screening_public_surface_allowed', ok,
    'screening_resolve/log_event must NOT raise insufficient_privilege for anon');
END $$;

-- 2c. authenticated (no valid auth.uid()) must still be GATED by the
--     function body for admin RPCs — i.e. raise an authorization error
--     even though EXECUTE is granted.
SELECT pg_temp.expect_denied('behav.authenticated_noctx.admin_grant_storage', 'authenticated',
  'SELECT public.admin_grant_storage(gen_random_uuid(), 10, ''t'')');
SELECT pg_temp.expect_denied('behav.authenticated_noctx.admin_review_queue', 'authenticated',
  'SELECT public.admin_review_queue(NULL)');
SELECT pg_temp.expect_denied('behav.authenticated_noctx.admin_provision_creator_plan', 'authenticated',
  'SELECT public.admin_provision_creator_plan(gen_random_uuid(), NULL, ''basic'', 0, NULL, NULL, NULL)');
SELECT pg_temp.expect_denied('behav.authenticated_noctx.claim_admin_if_none', 'authenticated',
  'SELECT public.claim_admin_if_none()');
SELECT pg_temp.expect_denied('behav.authenticated_noctx.grant_creator_role', 'authenticated',
  'SELECT public.grant_creator_role(gen_random_uuid())');
SELECT pg_temp.expect_denied('behav.authenticated_noctx.set_initial_role', 'authenticated',
  'SELECT public.set_initial_role(''admin'')');

-- 2d. has_role / is_super_admin are pure read helpers — authenticated
--     should be ALLOWED to call them (they just return boolean). We're
--     verifying that EXECUTE works and they don't raise.
DO $$
DECLARE ok boolean := true; errmsg text;
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.has_role(gen_random_uuid(), 'admin'::app_role);
    PERFORM public.is_super_admin(gen_random_uuid());
    PERFORM public.is_workspace_admin(gen_random_uuid(), gen_random_uuid());
    PERFORM public.is_workspace_member(gen_random_uuid(), gen_random_uuid());
    RESET ROLE;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS errmsg = MESSAGE_TEXT;
    RESET ROLE;
    ok := false;
  END;
  PERFORM pg_temp.t_assert('behav.authenticated.role_helpers_callable', ok,
    COALESCE(errmsg, 'unexpected error'));
END $$;

-- 2e. service_role must be allowed on a representative slice (these are
--     called from edge functions). No-context calls may raise business
--     errors, but never insufficient_privilege.
DO $$
DECLARE ok boolean := true; errmsg text; errcode text;
  fns text[] := ARRAY[
    'SELECT public.admin_exists()',
    'SELECT public.admin_review_queue(NULL)',
    'SELECT public.sweep_manual_invoices_overdue()',
    'SELECT public.sweep_screening_invites_expired()',
    'SELECT public.has_role(gen_random_uuid(), ''admin''::app_role)'
  ];
  s text;
BEGIN
  FOREACH s IN ARRAY fns LOOP
    BEGIN
      SET LOCAL ROLE service_role;
      EXECUTE s;
      RESET ROLE;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS errmsg = MESSAGE_TEXT, errcode = RETURNED_SQLSTATE;
      RESET ROLE;
      IF errcode = '42501' THEN
        ok := false;
        PERFORM pg_temp.t_assert(
          format('behav.service_role.privileged[%s]', s),
          false, format('insufficient_privilege: %s', errmsg));
      END IF;
    END;
  END LOOP;
  IF ok THEN
    PERFORM pg_temp.t_assert('behav.service_role.privileged_slice', true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. Report & exit
-- ---------------------------------------------------------------------
DO $$
DECLARE
  total int;
  failed int;
  r record;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT passed) INTO total, failed FROM _test_results;
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'SECURITY DEFINER test suite: % total, % failed', total, failed;
  RAISE NOTICE '====================================================';
  IF failed > 0 THEN
    FOR r IN SELECT name, detail FROM _test_results WHERE NOT passed ORDER BY name LOOP
      RAISE NOTICE '  FAIL  %  —  %', r.name, COALESCE(r.detail, '');
    END LOOP;
    RAISE EXCEPTION 'SECURITY DEFINER test suite failed: % assertion(s) did not pass', failed;
  END IF;
END $$;

ROLLBACK;
