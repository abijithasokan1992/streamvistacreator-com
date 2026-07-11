-- Regression tests for public.partner_profiles_public
--
-- Guarantees the intentional PII-safe security-definer projection over the
-- admin-only public.partner_profiles base table stays correct:
--
--   1. anon and authenticated can read active, published channel-partner rows via the view.
--   2. Inactive, unpublished, or non-channel-partner orgs are NOT returned by the view.
--   3. contact_email, contact_name, contact_phone, internal_notes, and other
--      sensitive columns are absent from the view schema.
--   4. Direct SELECT on partner_profiles is denied for anon and authenticated (non-admin).
--   5. The view definition uses an explicit column allowlist and never uses SELECT *.
--
-- Runs inside a rolled-back transaction.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f partner_profiles_public_view.sql
\set ON_ERROR_STOP on
BEGIN;

-- --------------------------------------------------------------------------
-- Fixtures
-- --------------------------------------------------------------------------
CREATE TEMP TABLE _o(kind text primary key, id uuid);
INSERT INTO _o VALUES
  ('cp_active_pub',      gen_random_uuid()),  -- included
  ('cp_inactive',        gen_random_uuid()),  -- excluded (partner is_active=false)
  ('cp_unpublished_org', gen_random_uuid()),  -- excluded (org.published=false)
  ('cp_inactive_org',    gen_random_uuid()),  -- excluded (org.status<>'active')
  ('not_channel',        gen_random_uuid());  -- excluded (org_kind<>'channel_partner')

INSERT INTO public.organizations(id, name, org_kind, published, status)
SELECT id, 'fixture-'||kind, 'channel_partner'::org_kind, true, 'active'::org_status
  FROM _o WHERE kind IN ('cp_active_pub','cp_inactive')
UNION ALL
SELECT id, 'fixture-'||kind, 'channel_partner'::org_kind, false, 'active'::org_status
  FROM _o WHERE kind='cp_unpublished_org'
UNION ALL
SELECT id, 'fixture-'||kind, 'channel_partner'::org_kind, true, 'inactive'::org_status
  FROM _o WHERE kind='cp_inactive_org'
UNION ALL
SELECT id, 'fixture-'||kind, 'creator'::org_kind, true, 'active'::org_status
  FROM _o WHERE kind='not_channel';

INSERT INTO public.partner_profiles(id, organization_id, slug, name, is_active)
SELECT gen_random_uuid(), id, 'slug-'||kind, 'fixture-'||kind,
       CASE WHEN kind='cp_inactive' THEN false ELSE true END
  FROM _o;

-- --------------------------------------------------------------------------
-- 3. Sensitive columns must NOT exist on the view
-- --------------------------------------------------------------------------
DO $$
DECLARE
  forbidden text;
  leaked    text;
BEGIN
  FOREACH forbidden IN ARRAY ARRAY[
    'contact_email','contact_name','contact_phone','internal_notes'
  ] LOOP
    SELECT column_name INTO leaked
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='partner_profiles_public'
       AND column_name=forbidden;
    IF leaked IS NOT NULL THEN
      RAISE EXCEPTION 'FAIL: sensitive column % is exposed by partner_profiles_public', forbidden;
    END IF;
  END LOOP;
END$$;

-- --------------------------------------------------------------------------
-- 5. View definition uses an explicit column allowlist (no SELECT *)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  def text;
BEGIN
  SELECT pg_get_viewdef('public.partner_profiles_public'::regclass, true) INTO def;
  IF def ~* '(^|[^.\w])\*' THEN
    RAISE EXCEPTION 'FAIL: partner_profiles_public definition appears to use SELECT * : %', def;
  END IF;
  IF def !~* 'organization_id' OR def !~* 'slug' THEN
    RAISE EXCEPTION 'FAIL: partner_profiles_public definition missing expected allowlisted columns';
  END IF;
END$$;

-- --------------------------------------------------------------------------
-- 1 + 2. Row visibility via the view for anon and authenticated
-- --------------------------------------------------------------------------
DO $$
DECLARE
  active_id uuid;
  cnt int;
BEGIN
  SELECT id INTO active_id FROM _o WHERE kind='cp_active_pub';

  -- anon
  SET LOCAL ROLE anon;
  SELECT count(*) INTO cnt FROM public.partner_profiles_public
    WHERE organization_id = active_id;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL(anon): expected 1 active/published channel-partner row, got %', cnt;
  END IF;

  SELECT count(*) INTO cnt FROM public.partner_profiles_public
   WHERE organization_id IN (SELECT id FROM _o WHERE kind <> 'cp_active_pub');
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL(anon): view leaked % non-eligible rows', cnt;
  END IF;
  RESET ROLE;

  -- authenticated (no JWT claim needed; view filters by columns, not auth.uid())
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO cnt FROM public.partner_profiles_public
    WHERE organization_id = active_id;
  IF cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL(authenticated): expected 1 row, got %', cnt;
  END IF;

  SELECT count(*) INTO cnt FROM public.partner_profiles_public
   WHERE organization_id IN (SELECT id FROM _o WHERE kind <> 'cp_active_pub');
  IF cnt <> 0 THEN
    RAISE EXCEPTION 'FAIL(authenticated): view leaked % non-eligible rows', cnt;
  END IF;
  RESET ROLE;
END$$;

-- --------------------------------------------------------------------------
-- 4. Direct SELECT on partner_profiles denied for non-admin roles
-- --------------------------------------------------------------------------
DO $$
DECLARE
  cnt int;
BEGIN
  -- anon
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO cnt FROM public.partner_profiles;
    IF cnt > 0 THEN
      RAISE EXCEPTION 'FAIL(anon): direct read of partner_profiles returned % rows', cnt;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    -- acceptable: grant-level denial
    NULL;
  END;
  RESET ROLE;

  -- authenticated, no admin role
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT count(*) INTO cnt FROM public.partner_profiles;
    IF cnt > 0 THEN
      RAISE EXCEPTION 'FAIL(authenticated non-admin): direct read of partner_profiles returned % rows', cnt;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  RESET ROLE;
END$$;

ROLLBACK;
