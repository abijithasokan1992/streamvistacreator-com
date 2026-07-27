-- =====================================================================
-- Security contract: admin_set_title_commercial_state
-- Transaction-safe. Rolls back all fixtures. Run with ON_ERROR_STOP=1
-- against an isolated Supabase preview/test database only.
-- =====================================================================
BEGIN;

DO $$
DECLARE
  v_admin uuid := gen_random_uuid();
  v_buyer uuid := gen_random_uuid();
  v_owner uuid := gen_random_uuid();
  v_title uuid;
  v_prev_count int;
  v_new_count int;
  v_row public.title_commercial_profiles;
  v_err text;
BEGIN
  -- Fixtures
  INSERT INTO public.user_roles(user_id, role) VALUES
    (v_admin, 'admin'::app_role),
    (v_buyer, 'buyer'::app_role);

  INSERT INTO public.content_titles(id, title, owner_user_id, status, kind)
  VALUES (gen_random_uuid(), 'Batch2 Test Title', v_owner,
          'ready_for_distribution'::content_status, 'film'::title_kind)
  RETURNING id INTO v_title;

  -- 1. Non-admin -> forbidden
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title, 'licensing_open'::title_commercial_status, true, 'buyer tries to publish');
    RAISE EXCEPTION 'FAIL: buyer was allowed to change commercial state';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- 2. Admin, empty reason -> rejected
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title, 'licensing_open'::title_commercial_status, true, '   ');
    RAISE EXCEPTION 'FAIL: empty reason accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- 3. Admin, missing title -> not found
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      gen_random_uuid(), 'licensing_open'::title_commercial_status, true, 'valid reason here');
    RAISE EXCEPTION 'FAIL: unknown title id accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;

  -- 4. Happy path -> upserts and writes exactly one audit row
  SELECT count(*) INTO v_prev_count FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title;

  v_row := public.admin_set_title_commercial_state(
    v_title, 'licensing_open'::title_commercial_status, true,
    'Opening title for OTT licensing');

  IF v_row.commercial_status <> 'licensing_open'::title_commercial_status
     OR v_row.published_to_buyers <> true THEN
    RAISE EXCEPTION 'FAIL: state not persisted (%, %)',
                    v_row.commercial_status, v_row.published_to_buyers;
  END IF;

  SELECT count(*) INTO v_new_count FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title;
  IF v_new_count <> v_prev_count + 1 THEN
    RAISE EXCEPTION 'FAIL: expected one new audit row, got % -> %',
                    v_prev_count, v_new_count;
  END IF;

  -- 5. Reason and prev/new snapshot are captured
  PERFORM 1 FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title
      AND details->>'reason' = 'Opening title for OTT licensing'
      AND details->>'new_commercial_status' = 'licensing_open'
      AND (details->>'new_published_to_buyers')::boolean = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: audit details missing reason/state snapshot';
  END IF;

  -- 6. Toggle back -> new audit row captures previous state
  v_row := public.admin_set_title_commercial_state(
    v_title, 'internal_hold'::title_commercial_status, false,
    'Pulling back for legal recheck');

  PERFORM 1 FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title
      AND details->>'previous_commercial_status' = 'licensing_open'
      AND details->>'new_commercial_status' = 'internal_hold'
      AND (details->>'previous_published_to_buyers')::boolean = true
      AND (details->>'new_published_to_buyers')::boolean = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: toggle audit did not record prev/new snapshot';
  END IF;

  RAISE NOTICE 'admin_set_title_commercial_state: all contract checks passed';
END $$;

ROLLBACK;

-- 7. EXECUTE privilege: revoked from PUBLIC, granted only to authenticated.
SELECT CASE
  WHEN has_function_privilege('public',
    'public.admin_set_title_commercial_state(uuid, public.title_commercial_status, boolean, text)',
    'EXECUTE') THEN 'FAIL: PUBLIC has EXECUTE'
  ELSE 'OK: PUBLIC does not have EXECUTE'
END AS public_check;

SELECT CASE
  WHEN has_function_privilege('authenticated',
    'public.admin_set_title_commercial_state(uuid, public.title_commercial_status, boolean, text)',
    'EXECUTE') THEN 'OK: authenticated has EXECUTE'
  ELSE 'FAIL: authenticated missing EXECUTE'
END AS authenticated_check;
