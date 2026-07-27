-- =====================================================================
-- SQL security contract for public.buyer_list_marketplace_titles()
-- ---------------------------------------------------------------------
-- Run against a local/test database only — NEVER against production.
--
--   psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/security/buyer_marketplace_rpc.sql
--
-- The suite requires the pending Batch 1 migration to be applied to the
-- target database first:
--   supabase/migrations-pending/20260727101915_buyer_marketplace_rpc.sql
--
-- All assertions run inside a single transaction that is ROLLED BACK at
-- the end — the target database is never mutated.
-- =====================================================================
\set ON_ERROR_STOP on
\timing off

BEGIN;

CREATE TEMP TABLE _results(name text PRIMARY KEY, passed boolean, detail text) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.t(_name text, _cond boolean, _detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _results(name, passed, detail) VALUES (_name, _cond, _detail)
  ON CONFLICT (name) DO UPDATE SET passed = EXCLUDED.passed, detail = EXCLUDED.detail;
  IF NOT _cond THEN RAISE WARNING '  ✗ % — %', _name, COALESCE(_detail,'(no detail)'); END IF;
END $$;

-- ---------------------------------------------------------------------
-- 1. Contract: privileges & return-column shape (no fixtures required)
-- ---------------------------------------------------------------------
-- 1a. EXECUTE revoked from PUBLIC / anon; granted to authenticated.
SELECT pg_temp.t(
  'grants.anon.denied',
  NOT has_function_privilege('anon', 'public.buyer_list_marketplace_titles()', 'EXECUTE')
);
SELECT pg_temp.t(
  'grants.public.denied',
  NOT has_function_privilege('public', 'public.buyer_list_marketplace_titles()', 'EXECUTE')
);
SELECT pg_temp.t(
  'grants.authenticated.allowed',
  has_function_privilege('authenticated', 'public.buyer_list_marketplace_titles()', 'EXECUTE')
);
SELECT pg_temp.t(
  'grants.service_role.allowed',
  has_function_privilege('service_role', 'public.buyer_list_marketplace_titles()', 'EXECUTE')
);

-- 1b. Confidential columns MUST NOT appear in the return contract.
--     We assert the exact allow-listed column set.
WITH cols AS (
  SELECT array_agg(attname ORDER BY attnum) AS names
  FROM (
    SELECT (unnest).name AS attname, ordinality AS attnum
    FROM (
      SELECT WITH ORDINALITY unnest(proallargtypes) FROM pg_proc
      WHERE oid = 'public.buyer_list_marketplace_titles()'::regprocedure
    ) x
  ) y
), expected AS (
  SELECT ARRAY[
    'id','title','synopsis','language','genre','duration_minutes','kind',
    'metadata_year','commercial_status','screener_available',
    'licensing_nonexclusive_available','licensing_exclusive_available',
    'acquisition_available','distribution_partnership_available',
    'buyer_facing_summary','poster_url','updated_at'
  ]::text[] AS names
)
SELECT pg_temp.t(
  'contract.return_columns.exact',
  (SELECT array(SELECT unnest(names) ORDER BY 1) FROM cols)
  = (SELECT array(SELECT unnest(names) ORDER BY 1) FROM expected)
);

-- Positive confidentiality check: none of these ever appear in the shape.
DO $$
DECLARE forbidden text[] := ARRAY[
  'cost_price','master_url','master_path','pii','banking','upi_vpa',
  'internal_notes','admin_notes','watermark_secret','service_key'
];
DECLARE bad text;
BEGIN
  SELECT string_agg(name, ',') INTO bad
  FROM information_schema.parameters
  WHERE specific_schema='public'
    AND specific_name LIKE 'buyer_list_marketplace_titles%'
    AND parameter_mode='OUT'
    AND name = ANY(forbidden);
  PERFORM pg_temp.t('contract.confidential_columns.absent', bad IS NULL,
    format('unexpected confidential columns: %s', COALESCE(bad,'')));
END $$;

-- ---------------------------------------------------------------------
-- 2. Behavioral: fixtures + role-switch tests (skipped if role switch
--    is not possible in this environment; section 1 remains authoritative)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _caps(role text PRIMARY KEY, ok boolean) ON COMMIT DROP;
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', r);
      EXECUTE 'RESET ROLE';
      INSERT INTO _caps VALUES (r, true);
    EXCEPTION WHEN OTHERS THEN
      EXECUTE 'RESET ROLE';
      INSERT INTO _caps VALUES (r, false);
    END;
  END LOOP;
END $$;

-- Fixture seeding — inside the rolled-back transaction only.
-- We create 5 users covering each rejection reason plus one happy path.
DO $$
DECLARE
  u_non_buyer      uuid := gen_random_uuid();
  u_suspended      uuid := gen_random_uuid();
  u_unverified     uuid := gen_random_uuid();
  u_no_nda         uuid := gen_random_uuid();
  u_susp_org       uuid := gen_random_uuid();
  u_ok             uuid := gen_random_uuid();
  org_ok           uuid := gen_random_uuid();
  org_susp         uuid := gen_random_uuid();
  t_ready_open     uuid := gen_random_uuid();
  t_ready_no_chan  uuid := gen_random_uuid();
  t_draft          uuid := gen_random_uuid();
  t_unpublished    uuid := gen_random_uuid();
  t_bad_year       uuid := gen_random_uuid();
BEGIN
  -- Users need rows in user_profiles (for is_suspended) and user_roles.
  INSERT INTO public.user_profiles(user_id, is_suspended) VALUES
    (u_non_buyer, false),
    (u_suspended, true),
    (u_unverified, false),
    (u_no_nda, false),
    (u_susp_org, false),
    (u_ok, false)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_suspended, 'buyer'::app_role),
    (u_unverified, 'buyer'::app_role),
    (u_no_nda, 'buyer'::app_role),
    (u_susp_org, 'buyer'::app_role),
    (u_ok, 'buyer'::app_role)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.organizations(id, kind, status, name)
    VALUES (org_ok, 'buyer'::org_kind, 'active'::org_status, '_t_ok'),
           (org_susp, 'buyer'::org_kind, 'suspended'::org_status, '_t_susp')
    ON CONFLICT DO NOTHING;

  -- entity_profiles: unverified vs verified.
  INSERT INTO public.entity_profiles(user_id, kind, verification_status, org_id)
    VALUES
      (u_unverified, 'buyer', 'unverified', NULL),
      (u_no_nda,     'buyer', 'verified',   NULL),
      (u_susp_org,   'buyer', 'verified',   org_susp),
      (u_ok,         'buyer', 'verified',   org_ok)
    ON CONFLICT DO NOTHING;

  -- NDA acceptances (skip for u_no_nda).
  INSERT INTO public.legal_acceptances(user_id, agreement_type)
    VALUES
      (u_unverified, 'buyer_request_confidentiality'::legal_agreement_type),
      (u_susp_org,   'buyer_request_confidentiality'::legal_agreement_type),
      (u_ok,         'buyer_request_confidentiality'::legal_agreement_type)
    ON CONFLICT DO NOTHING;

  -- Titles + commercial profiles.
  INSERT INTO public.content_titles(id, title, status, kind, metadata)
    VALUES
      (t_ready_open,    '_t_open',     'ready_for_distribution'::content_status,
        'film'::title_kind, jsonb_build_object('year','2024')),
      (t_ready_no_chan, '_t_nochan',   'ready_for_distribution'::content_status,
        'film'::title_kind, jsonb_build_object('year','2023')),
      (t_draft,         '_t_draft',    'draft'::content_status,
        'film'::title_kind, jsonb_build_object('year','2022')),
      (t_unpublished,   '_t_unpub',    'ready_for_distribution'::content_status,
        'film'::title_kind, jsonb_build_object('year','2021')),
      (t_bad_year,      '_t_badyear',  'ready_for_distribution'::content_status,
        'film'::title_kind, jsonb_build_object('year','not-a-year'));

  INSERT INTO public.title_commercial_profiles(
    title_id, commercial_status, published_to_buyers,
    available_for_screeners, available_for_nonexclusive_license,
    available_for_exclusive_license, available_for_acquisition,
    available_for_distribution_partnership
  ) VALUES
    (t_ready_open,    'licensing_open'::title_commercial_status, true,  true, true, false, false, false),
    (t_ready_no_chan, 'licensing_open'::title_commercial_status, true,  false, false, false, false, false),
    (t_draft,         'licensing_open'::title_commercial_status, true,  true, true, false, false, false),
    (t_unpublished,   'licensing_open'::title_commercial_status, false, true, true, false, false, false),
    (t_bad_year,      'licensing_open'::title_commercial_status, true,  true, false, false, false, false);

  -- Save uuids to a temp table for the role-scoped checks below.
  CREATE TEMP TABLE _fx(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
  INSERT INTO _fx VALUES
    ('u_non_buyer',u_non_buyer),('u_suspended',u_suspended),
    ('u_unverified',u_unverified),('u_no_nda',u_no_nda),
    ('u_susp_org',u_susp_org),('u_ok',u_ok),
    ('t_ready_open',t_ready_open),('t_bad_year',t_bad_year);
END $$;

-- Helper: run the RPC as `authenticated` with a spoofed auth.uid() via
-- request.jwt.claim.sub GUC (matches how PostgREST populates auth.uid()).
CREATE OR REPLACE FUNCTION pg_temp.call_as(_uid uuid)
RETURNS TABLE(id uuid, metadata_year integer) LANGUAGE plpgsql AS $$
DECLARE cap boolean;
BEGIN
  SELECT ok INTO cap FROM _caps WHERE role='authenticated';
  IF NOT COALESCE(cap,false) THEN RETURN; END IF;
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  RETURN QUERY SELECT r.id, r.metadata_year FROM public.buyer_list_marketplace_titles() r;
  EXECUTE 'RESET ROLE';
END $$;

DO $$
DECLARE n int; y int; cap boolean;
BEGIN
  SELECT ok INTO cap FROM _caps WHERE role='authenticated';
  IF NOT COALESCE(cap,false) THEN
    INSERT INTO _results VALUES ('behavioral.suite[SKIPPED]', true, 'no SET ROLE capability');
    RETURN;
  END IF;

  -- 2a. anon denied at grant layer.
  BEGIN
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM * FROM public.buyer_list_marketplace_titles();
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.t('behav.anon.denied', false, 'anon call unexpectedly succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.t('behav.anon.denied', true);
  END;

  -- 2b. non-buyer authenticated → empty.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_non_buyer'));
  PERFORM pg_temp.t('behav.non_buyer.empty', n = 0, format('rows=%s', n));

  -- 2c. suspended buyer → empty.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_suspended'));
  PERFORM pg_temp.t('behav.suspended.empty', n = 0, format('rows=%s', n));

  -- 2d. unverified buyer → empty.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_unverified'));
  PERFORM pg_temp.t('behav.unverified.empty', n = 0, format('rows=%s', n));

  -- 2e. verified buyer WITHOUT NDA → empty.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_no_nda'));
  PERFORM pg_temp.t('behav.no_nda.empty', n = 0, format('rows=%s', n));

  -- 2f. verified buyer whose org is suspended → empty.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_susp_org'));
  PERFORM pg_temp.t('behav.suspended_org.empty', n = 0, format('rows=%s', n));

  -- 2g. verified + NDA buyer → sees only eligible titles.
  SELECT count(*) INTO n FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_ok'));
  PERFORM pg_temp.t('behav.happy.some_rows', n >= 1, format('rows=%s', n));

  -- 2h. non-ready, unpublished, and no-channel titles are excluded.
  PERFORM pg_temp.t(
    'behav.excludes.non_ready_unpublished_nochan',
    NOT EXISTS (
      SELECT 1 FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_ok')) r
      WHERE r.id IN (
        SELECT id FROM public.content_titles
        WHERE title IN ('_t_draft','_t_unpub','_t_nochan')
      )
    )
  );

  -- 2i. eligible title present.
  PERFORM pg_temp.t(
    'behav.includes.eligible_title',
    EXISTS (
      SELECT 1 FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_ok')) r
      WHERE r.id = (SELECT v FROM _fx WHERE k='t_ready_open')
    )
  );

  -- 2j. malformed year → NULL without raising.
  SELECT metadata_year INTO y
    FROM pg_temp.call_as((SELECT v FROM _fx WHERE k='u_ok')) r
    WHERE r.id = (SELECT v FROM _fx WHERE k='t_bad_year');
  PERFORM pg_temp.t('behav.metadata_year.malformed_is_null', y IS NULL, format('got=%s', y));
END $$;

-- ---------------------------------------------------------------------
-- 3. Report
-- ---------------------------------------------------------------------
DO $$
DECLARE total int; failed int; r record;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT passed) INTO total, failed FROM _results;
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'buyer_list_marketplace_titles security suite: % total, % failed', total, failed;
  RAISE NOTICE '====================================================';
  IF failed > 0 THEN
    FOR r IN SELECT name, detail FROM _results WHERE NOT passed ORDER BY name LOOP
      RAISE NOTICE '  FAIL  %  —  %', r.name, COALESCE(r.detail,'');
    END LOOP;
    RAISE EXCEPTION 'buyer_list_marketplace_titles suite failed: % assertion(s)', failed;
  END IF;
END $$;

ROLLBACK;
