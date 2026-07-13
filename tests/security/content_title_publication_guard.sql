-- Publication guard behavioral test suite for public.content_titles.
--
-- Verifies the editorial publication sequence enforced by the
-- enforce_content_title_owner_write_scope() and
-- enforce_content_title_insert_scope() triggers plus the ct_insert_*
-- / ct_update_* RLS policies.
--
-- Requires:
--   * an admin user id in public.user_roles (role='admin' or 'super_admin')
--   * two creators + two workspaces + two owned content_titles
--   * the caller must already have a super_admin/admin JWT set via
--     request.jwt.claims (the SECURITY DEFINER verifier is gated by role)
--
-- Usage:
--   psql -v cA=... -v cB=... -v adm=... -v wsA=... -v wsB=... \
--        -v tA=... -v tB=... -f tests/security/content_title_publication_guard.sql
--
-- All 16+ assertions must return outcome='PASS'. Any FAIL should block
-- deploy and is investigated in Postgres logs.

BEGIN;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :'adm', 'role', 'authenticated')::text,
  false
);

SELECT test, outcome, detail
FROM public.__verify_content_title_pub_guard(
  :'cA'::uuid, :'cB'::uuid, :'adm'::uuid,
  :'wsA'::uuid, :'wsB'::uuid,
  :'tA'::uuid, :'tB'::uuid
);

-- Assert every row is PASS.
DO $$
DECLARE
  fails int;
BEGIN
  SELECT count(*) INTO fails
  FROM public.__verify_content_title_pub_guard(
    :'cA'::uuid, :'cB'::uuid, :'adm'::uuid,
    :'wsA'::uuid, :'wsB'::uuid,
    :'tA'::uuid, :'tB'::uuid
  )
  WHERE outcome <> 'PASS';
  IF fails > 0 THEN
    RAISE EXCEPTION 'publication_guard_tests_failed: % failures', fails;
  END IF;
END $$;

ROLLBACK;
