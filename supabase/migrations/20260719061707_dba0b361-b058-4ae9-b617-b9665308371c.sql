
-- 1. legacy_ref column for idempotent legacy imports
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS legacy_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS content_titles_legacy_ref_key
  ON public.content_titles(legacy_ref) WHERE legacy_ref IS NOT NULL;

-- 2. Find duplicate draft titles (read-only)
CREATE OR REPLACE FUNCTION public.mcp_find_duplicate_draft_titles(_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _result jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.has_mcp_control_role(_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH drafts AS (
    SELECT id, owner_user_id, lower(btrim(title)) AS norm_title, title, created_at
    FROM public.content_titles
    WHERE status = 'draft' AND submitted_at IS NULL
  ),
  grouped AS (
    SELECT
      owner_user_id,
      norm_title,
      max(title) AS title,
      count(*) AS cnt,
      array_agg(id::text ORDER BY created_at) AS ids,
      min(created_at) AS first_created,
      max(created_at) AS last_created,
      (max(created_at) - min(created_at)) AS span
    FROM drafts
    GROUP BY owner_user_id, norm_title
    HAVING count(*) > 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'title', title,
    'owner_user_id', owner_user_id,
    'duplicate_ids', ids,
    'count', cnt,
    'created_at_range', jsonb_build_array(first_created, last_created),
    'burst_insert', span < interval '5 seconds'
  ) ORDER BY cnt DESC)
  INTO _result
  FROM (SELECT * FROM grouped ORDER BY cnt DESC LIMIT greatest(_limit, 1)) t;

  RETURN COALESCE(_result, '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.mcp_find_duplicate_draft_titles(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_find_duplicate_draft_titles(int) TO authenticated;

-- 3. Delete draft titles by ID (write, guarded)
CREATE OR REPLACE FUNCTION public.mcp_delete_draft_titles(_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _deleted uuid[] := '{}';
  _skipped jsonb := '[]'::jsonb;
  _r record;
BEGIN
  IF _uid IS NULL OR NOT public.has_mcp_control_role(_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF public.mcp_kill_switch_on() THEN
    RAISE EXCEPTION 'writes_disabled' USING ERRCODE = '42501';
  END IF;
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('deleted', '[]'::jsonb, 'skipped_not_eligible', '[]'::jsonb);
  END IF;
  IF array_length(_ids, 1) > 50 THEN
    RAISE EXCEPTION 'too_many_ids: max 50 per call';
  END IF;

  FOR _r IN SELECT id, title, status, submitted_at, approved_at, published_at
            FROM public.content_titles
            WHERE id = ANY(_ids)
  LOOP
    IF _r.status = 'draft' AND _r.submitted_at IS NULL
       AND _r.approved_at IS NULL AND _r.published_at IS NULL THEN
      DELETE FROM public.content_titles WHERE id = _r.id;
      _deleted := array_append(_deleted, _r.id);
      INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, 'ctrl_delete_draft_titles', 'content_titles', TRUE,
              jsonb_build_object('title_id', _r.id, 'title', _r.title));
    ELSE
      _skipped := _skipped || jsonb_build_array(jsonb_build_object(
        'id', _r.id,
        'reason', format('status=%s, submitted_at=%s, approved_at=%s, published_at=%s',
                         _r.status, _r.submitted_at, _r.approved_at, _r.published_at)
      ));
    END IF;
  END LOOP;

  -- Note any requested IDs not found at all
  FOR _r IN SELECT unnest(_ids) AS id
  LOOP
    IF NOT (_r.id = ANY(_deleted))
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_skipped) e WHERE (e->>'id')::uuid = _r.id) THEN
      _skipped := _skipped || jsonb_build_array(jsonb_build_object(
        'id', _r.id, 'reason', 'not_found'
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'deleted', to_jsonb(_deleted),
    'skipped_not_eligible', _skipped
  );
END $$;

REVOKE ALL ON FUNCTION public.mcp_delete_draft_titles(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_delete_draft_titles(uuid[]) TO authenticated;

-- 4. Idempotent legacy title import (write, guarded)
CREATE OR REPLACE FUNCTION public.mcp_import_legacy_titles(_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted uuid[] := '{}';
  _updated uuid[] := '{}';
  _skipped jsonb := '[]'::jsonb;
  _rec jsonb;
  _existing_id uuid;
  _new_id uuid;
  _legacy_ref text;
  _title text;
  _owner uuid;
  _n int;
BEGIN
  IF _uid IS NULL OR NOT public.has_mcp_control_role(_uid) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF public.mcp_kill_switch_on() THEN
    RAISE EXCEPTION 'writes_disabled' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_records) <> 'array' THEN
    RAISE EXCEPTION 'records must be a JSON array';
  END IF;
  _n := jsonb_array_length(_records);
  IF _n = 0 THEN
    RETURN jsonb_build_object('inserted','[]'::jsonb,'updated','[]'::jsonb,'skipped_invalid','[]'::jsonb);
  END IF;
  IF _n > 50 THEN
    RAISE EXCEPTION 'too_many_records: max 50 per call';
  END IF;

  FOR _rec IN SELECT * FROM jsonb_array_elements(_records)
  LOOP
    _legacy_ref := nullif(btrim(_rec->>'legacy_ref'), '');
    _title := nullif(btrim(_rec->>'title'), '');
    _owner := nullif(_rec->>'owner_user_id','')::uuid;

    IF _legacy_ref IS NULL OR _title IS NULL OR _owner IS NULL THEN
      _skipped := _skipped || jsonb_build_array(jsonb_build_object(
        'record', _rec, 'reason', 'missing legacy_ref/title/owner_user_id'));
      CONTINUE;
    END IF;

    SELECT id INTO _existing_id FROM public.content_titles WHERE legacy_ref = _legacy_ref;

    IF _existing_id IS NOT NULL THEN
      UPDATE public.content_titles SET
        title = _title,
        synopsis = COALESCE(nullif(_rec->>'synopsis',''), synopsis),
        language = COALESCE(nullif(_rec->>'language',''), language),
        genre = COALESCE(nullif(_rec->>'genre',''), genre),
        duration_minutes = COALESCE(nullif(_rec->>'duration_minutes','')::int, duration_minutes),
        updated_at = now()
      WHERE id = _existing_id;
      _updated := array_append(_updated, _existing_id);
      INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, 'ctrl_import_legacy_titles', 'content_titles', TRUE,
              jsonb_build_object('title_id', _existing_id, 'legacy_ref', _legacy_ref, 'op','update'));
    ELSE
      INSERT INTO public.content_titles(
        owner_user_id, title, synopsis, language, genre, duration_minutes,
        status, legacy_ref
      ) VALUES (
        _owner, _title,
        nullif(_rec->>'synopsis',''),
        nullif(_rec->>'language',''),
        nullif(_rec->>'genre',''),
        nullif(_rec->>'duration_minutes','')::int,
        'draft', _legacy_ref
      ) RETURNING id INTO _new_id;
      _inserted := array_append(_inserted, _new_id);
      INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, 'ctrl_import_legacy_titles', 'content_titles', TRUE,
              jsonb_build_object('title_id', _new_id, 'legacy_ref', _legacy_ref, 'op','insert'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', to_jsonb(_inserted),
    'updated', to_jsonb(_updated),
    'skipped_invalid', _skipped
  );
END $$;

REVOKE ALL ON FUNCTION public.mcp_import_legacy_titles(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mcp_import_legacy_titles(jsonb) TO authenticated;
