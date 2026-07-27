-- =====================================================================
-- Security contract: admin_set_title_commercial_state (Batch 2 gap-closure)
-- Transaction-safe. Rolls back all fixtures. Run with ON_ERROR_STOP=1
-- against an isolated Supabase preview/test database only.
-- =====================================================================
BEGIN;

DO $$
DECLARE
  v_admin      uuid := gen_random_uuid();
  v_buyer      uuid := gen_random_uuid();
  v_owner      uuid := gen_random_uuid();
  v_title_rfd  uuid;
  v_title_draft uuid;
  v_row        public.title_commercial_profiles;
  v_prev_count int;
  v_new_count  int;
BEGIN
  -- Fixtures
  INSERT INTO public.user_roles(user_id, role) VALUES
    (v_admin, 'admin'::app_role),
    (v_buyer, 'buyer'::app_role);

  INSERT INTO public.content_titles(id, title, owner_user_id, status, kind)
  VALUES (gen_random_uuid(), 'Batch2 RFD Title', v_owner,
          'ready_for_distribution'::content_status, 'film'::title_kind)
  RETURNING id INTO v_title_rfd;

  INSERT INTO public.content_titles(id, title, owner_user_id, status, kind)
  VALUES (gen_random_uuid(), 'Batch2 Draft Title', v_owner,
          'draft'::content_status, 'film'::title_kind)
  RETURNING id INTO v_title_draft;

  ------------------------------------------------------------------
  -- 1. Non-admin -> forbidden
  ------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_buyer::text, true);
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title_rfd, 'licensing_open'::title_commercial_status, true,
      true, false, false, false, false,
      'buyer tries to publish');
    RAISE EXCEPTION 'FAIL: non-admin was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

  ------------------------------------------------------------------
  -- 2. Empty reason -> rejected
  ------------------------------------------------------------------
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title_rfd, 'licensing_open'::title_commercial_status, true,
      true, false, false, false, false,
      '   ');
    RAISE EXCEPTION 'FAIL: empty reason accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  ------------------------------------------------------------------
  -- 3. Non-RFD title cannot be published
  ------------------------------------------------------------------
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title_draft, 'licensing_open'::title_commercial_status, true,
      true, false, false, false, false,
      'try to publish a draft title');
    RAISE EXCEPTION 'FAIL: non-RFD title was published';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  ------------------------------------------------------------------
  -- 4. RFD title with no availability flag cannot be published
  ------------------------------------------------------------------
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title_rfd, 'licensing_open'::title_commercial_status, true,
      false, false, false, false, false,
      'publish with zero flags');
    RAISE EXCEPTION 'FAIL: published with no availability flag';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  ------------------------------------------------------------------
  -- 5. RFD title, ineligible commercial_status cannot be published
  ------------------------------------------------------------------
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      v_title_rfd, 'internal_hold'::title_commercial_status, true,
      true, false, false, false, false,
      'publish with ineligible status');
    RAISE EXCEPTION 'FAIL: ineligible status was published';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  ------------------------------------------------------------------
  -- 6. Missing title -> not found
  ------------------------------------------------------------------
  BEGIN
    PERFORM public.admin_set_title_commercial_state(
      gen_random_uuid(), 'licensing_open'::title_commercial_status, true,
      true, false, false, false, false,
      'valid reason here');
    RAISE EXCEPTION 'FAIL: unknown title id accepted';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;

  ------------------------------------------------------------------
  -- 7. Happy path — eligible RFD title publishes and audits
  ------------------------------------------------------------------
  SELECT count(*) INTO v_prev_count FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title_rfd;

  v_row := public.admin_set_title_commercial_state(
    v_title_rfd, 'licensing_open'::title_commercial_status, true,
    false, true, false, false, false,
    'Opening title for OTT licensing');

  IF v_row.commercial_status <> 'licensing_open'::title_commercial_status
     OR v_row.published_to_buyers <> true
     OR v_row.available_for_nonexclusive_license <> true
     OR v_row.available_for_screeners <> false THEN
    RAISE EXCEPTION 'FAIL: state/flags not persisted';
  END IF;

  SELECT count(*) INTO v_new_count FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title_rfd;
  IF v_new_count <> v_prev_count + 1 THEN
    RAISE EXCEPTION 'FAIL: expected exactly one new audit row';
  END IF;

  -- Audit snapshot must capture prev + new including flags
  PERFORM 1 FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title_rfd
      AND details->>'reason' = 'Opening title for OTT licensing'
      AND details->>'new_commercial_status' = 'licensing_open'
      AND (details->>'new_published_to_buyers')::boolean = true
      AND (details#>>'{new_flags,available_for_nonexclusive_license}')::boolean = true
      AND (details#>>'{previous_flags,available_for_nonexclusive_license}')::boolean = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: audit snapshot missing prev/new flags';
  END IF;

  ------------------------------------------------------------------
  -- 8. Unpublishing is always allowed to admins even when eligibility
  --    would fail (all flags off, status set to internal_hold).
  ------------------------------------------------------------------
  v_row := public.admin_set_title_commercial_state(
    v_title_rfd, 'internal_hold'::title_commercial_status, false,
    false, false, false, false, false,
    'pulling back for legal recheck');

  IF v_row.published_to_buyers <> false
     OR v_row.commercial_status <> 'internal_hold'::title_commercial_status THEN
    RAISE EXCEPTION 'FAIL: unpublish did not persist';
  END IF;

  PERFORM 1 FROM public.commercial_audit_log
    WHERE action = 'title_commercial_state.set'
      AND (details->>'title_id')::uuid = v_title_rfd
      AND details->>'previous_commercial_status' = 'licensing_open'
      AND details->>'new_commercial_status' = 'internal_hold'
      AND (details->>'previous_published_to_buyers')::boolean = true
      AND (details->>'new_published_to_buyers')::boolean = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: unpublish audit did not record prev/new snapshot';
  END IF;

  RAISE NOTICE 'admin_set_title_commercial_state: all contract checks passed';
END $$;

ROLLBACK;

-- 9. EXECUTE privilege: revoked from PUBLIC, granted only to authenticated.
SELECT CASE
  WHEN has_function_privilege('public',
    'public.admin_set_title_commercial_state(uuid, public.title_commercial_status, boolean, boolean, boolean, boolean, boolean, boolean, text)',
    'EXECUTE') THEN 'FAIL: PUBLIC has EXECUTE'
  ELSE 'OK: PUBLIC does not have EXECUTE'
END AS public_check;

SELECT CASE
  WHEN has_function_privilege('authenticated',
    'public.admin_set_title_commercial_state(uuid, public.title_commercial_status, boolean, boolean, boolean, boolean, boolean, boolean, text)',
    'EXECUTE') THEN 'OK: authenticated has EXECUTE'
  ELSE 'FAIL: authenticated missing EXECUTE'
END AS authenticated_check;
