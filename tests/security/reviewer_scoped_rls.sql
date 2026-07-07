-- Assignment-scoped RLS for reviewer tables.
-- Runs inside a rolled-back transaction. Asserts that:
--   * qc_reviewer sees only titles they are assigned to at stage='qc'
--   * legal_reviewer sees only titles they are assigned to at stage='legal'
--   * a reviewer without an assignment sees nothing
--   * admin sees every row
--
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f reviewer_scoped_rls.sql
\set ON_ERROR_STOP on
BEGIN;

-- Fixture users
CREATE TEMP TABLE _u(kind text primary key, id uuid);
INSERT INTO _u VALUES
  ('admin',     gen_random_uuid()),
  ('qc',        gen_random_uuid()),
  ('legal',     gen_random_uuid()),
  ('stranger',  gen_random_uuid()),
  ('owner',     gen_random_uuid());

INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::app_role FROM _u WHERE kind='admin' UNION ALL
SELECT id, 'qc_reviewer'::app_role FROM _u WHERE kind='qc' UNION ALL
SELECT id, 'legal_reviewer'::app_role FROM _u WHERE kind='legal' UNION ALL
SELECT id, 'qc_reviewer'::app_role FROM _u WHERE kind='stranger';

-- Fixture titles
CREATE TEMP TABLE _t(kind text primary key, id uuid);
INSERT INTO _t VALUES
  ('assigned_qc',    gen_random_uuid()),
  ('assigned_legal', gen_random_uuid()),
  ('unassigned',     gen_random_uuid());

INSERT INTO public.content_titles(id, title, status, owner_user_id)
SELECT t.id, 'fixture-'||t.kind, 'qc_review',
       (SELECT id FROM _u WHERE kind='owner')
FROM _t t;

-- Assignments + checklist rows for each title
INSERT INTO public.title_review_assignments(title_id, stage, reviewer_user_id, assigned_by)
SELECT (SELECT id FROM _t WHERE kind='assigned_qc'), 'qc',
       (SELECT id FROM _u WHERE kind='qc'),
       (SELECT id FROM _u WHERE kind='admin');
INSERT INTO public.title_review_assignments(title_id, stage, reviewer_user_id, assigned_by)
SELECT (SELECT id FROM _t WHERE kind='assigned_legal'), 'legal',
       (SELECT id FROM _u WHERE kind='legal'),
       (SELECT id FROM _u WHERE kind='admin');

INSERT INTO public.title_review_checklist(title_id, stage, item_key, item_label, status)
SELECT id, 'qc',    'k1', 'l1', 'pending' FROM _t WHERE kind='assigned_qc' UNION ALL
SELECT id, 'legal', 'k1', 'l1', 'pending' FROM _t WHERE kind='assigned_legal' UNION ALL
SELECT id, 'qc',    'k1', 'l1', 'pending' FROM _t WHERE kind='unassigned';

-- Helper to run a query as a specific user under RLS
CREATE OR REPLACE FUNCTION pg_temp.as_user(_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text, true);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert_eq(_label text, _got int, _want int) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF _got IS DISTINCT FROM _want THEN
    RAISE EXCEPTION '% expected=% got=%', _label, _want, _got;
  END IF;
  RAISE NOTICE 'ok: % (=%)', _label, _got;
END $$;

DO $$
DECLARE
  qc_uid    uuid := (SELECT id FROM _u WHERE kind='qc');
  legal_uid uuid := (SELECT id FROM _u WHERE kind='legal');
  strn_uid  uuid := (SELECT id FROM _u WHERE kind='stranger');
  adm_uid   uuid := (SELECT id FROM _u WHERE kind='admin');
  n int;
BEGIN
  -- QC reviewer: sees only their assigned qc checklist row (1)
  PERFORM pg_temp.as_user(qc_uid);
  SELECT count(*) INTO n FROM public.title_review_checklist;
  PERFORM pg_temp.assert_eq('qc sees own checklist', n, 1);
  SELECT count(*) INTO n FROM public.title_review_assignments;
  PERFORM pg_temp.assert_eq('qc sees own assignment', n, 1);

  -- Legal reviewer: sees only their legal checklist row (1)
  PERFORM pg_temp.as_user(legal_uid);
  SELECT count(*) INTO n FROM public.title_review_checklist;
  PERFORM pg_temp.assert_eq('legal sees own checklist', n, 1);

  -- Reviewer with no assignment: sees nothing
  PERFORM pg_temp.as_user(strn_uid);
  SELECT count(*) INTO n FROM public.title_review_checklist;
  PERFORM pg_temp.assert_eq('stranger sees nothing', n, 0);

  -- Admin: sees all 3 checklist rows
  PERFORM pg_temp.as_user(adm_uid);
  SELECT count(*) INTO n FROM public.title_review_checklist;
  PERFORM pg_temp.assert_eq('admin sees all', n, 3);
END $$;

ROLLBACK;
