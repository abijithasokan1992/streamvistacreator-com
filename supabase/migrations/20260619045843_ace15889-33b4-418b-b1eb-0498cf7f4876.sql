
-- Stream 4A — Creator Dashboard MVP: schema constraints, indexes, and RPCs.
-- Reuses existing tables (content_titles, title_assets, recent_uploads, admin_audit_log).
-- No new tables. No new content statuses. Reuses existing approved workflow.

-- =========================================================================
-- 1. title_assets — category constraint (MVP + near-future categories)
-- =========================================================================
ALTER TABLE public.title_assets
  DROP CONSTRAINT IF EXISTS title_assets_category_check;

ALTER TABLE public.title_assets
  ADD CONSTRAINT title_assets_category_check
  CHECK (category IN (
    'feature_film',
    'trailer',
    'poster',
    'censor_certificate',
    'ownership_documents',
    'captions',
    'audio_tracks',
    'artwork',
    -- legacy aliases retained so existing rows / code continue to work
    'censor_cert',
    'ownership',
    'audio',
    'subtitle',
    'legal',
    'sales'
  ));

-- One primary asset per (title, category)
CREATE UNIQUE INDEX IF NOT EXISTS title_assets_one_primary_per_category
  ON public.title_assets (title_id, category)
  WHERE is_primary = true;

-- =========================================================================
-- 2. Performance indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS content_titles_owner_status_idx
  ON public.content_titles (owner_user_id, status);

CREATE INDEX IF NOT EXISTS content_titles_workspace_idx
  ON public.content_titles (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS title_assets_title_idx
  ON public.title_assets (title_id);

CREATE INDEX IF NOT EXISTS recent_uploads_user_status_idx
  ON public.recent_uploads (user_id, status);

-- =========================================================================
-- 3. RPC: complete_title_asset_upload
--    Atomically: verify ownership, verify upload, attach asset, audit.
--    Fails hard if OCI object record / upload row is missing or invalid.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.complete_title_asset_upload(
  _title_id    uuid,
  _upload_id   uuid,
  _category    text,
  _is_primary  boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_locked boolean;
  t_workspace uuid;
  u_user uuid;
  u_status text;
  u_object_key text;
  new_asset_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Title ownership + lock check
  SELECT owner_user_id, locked, workspace_id
    INTO t_owner, t_locked, t_workspace
  FROM public.content_titles
  WHERE id = _title_id;

  IF t_owner IS NULL THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;
  IF t_owner <> uid AND NOT public.has_role(uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF t_locked = true AND NOT public.has_role(uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Title is locked' USING ERRCODE = '42501';
  END IF;

  -- Oracle validation: upload row must exist, belong to user, and have an object_key
  SELECT user_id, status, object_key
    INTO u_user, u_status, u_object_key
  FROM public.recent_uploads
  WHERE id = _upload_id;

  IF u_user IS NULL THEN
    RAISE EXCEPTION 'Upload Failed — Oracle Database record missing' USING ERRCODE = 'P0002';
  END IF;
  IF u_user <> uid AND NOT public.has_role(uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Upload Failed — owner mismatch' USING ERRCODE = '42501';
  END IF;
  IF u_object_key IS NULL OR length(u_object_key) = 0 THEN
    RAISE EXCEPTION 'Upload Failed — Oracle object_key missing' USING ERRCODE = '22023';
  END IF;
  IF u_status IS NULL OR u_status IN ('error','failed','aborted') THEN
    RAISE EXCEPTION 'Upload Failed — invalid status %', u_status USING ERRCODE = '22023';
  END IF;

  -- Demote any other primary in this category for this title.
  IF _is_primary THEN
    UPDATE public.title_assets
       SET is_primary = false
     WHERE title_id = _title_id
       AND category = _category
       AND is_primary = true;
  END IF;

  INSERT INTO public.title_assets (title_id, upload_id, category, is_primary)
  VALUES (_title_id, _upload_id, _category, COALESCE(_is_primary, true))
  RETURNING id INTO new_asset_id;

  -- Mark upload row as verified (best effort — schema permitting)
  UPDATE public.recent_uploads
     SET status = 'verified', updated_at = now()
   WHERE id = _upload_id
     AND status NOT IN ('verified');

  -- Audit (actor, organization/workspace, title, upload, category)
  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, target_user_id, target_email, action, details
  )
  VALUES (
    uid,
    (SELECT email FROM auth.users WHERE id = uid),
    t_owner,
    (SELECT email FROM auth.users WHERE id = t_owner),
    'title_asset_uploaded',
    jsonb_build_object(
      'actor_user_id', uid,
      'organization_id', t_workspace,
      'title_id', _title_id,
      'upload_id', _upload_id,
      'category', _category,
      'asset_id', new_asset_id,
      'created_at', now()
    )
  );

  RETURN new_asset_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.complete_title_asset_upload(uuid, uuid, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_title_asset_upload(uuid, uuid, text, boolean) TO authenticated;

-- =========================================================================
-- 4. RPC: title_submission_readiness — read-only checklist for UI
-- =========================================================================
CREATE OR REPLACE FUNCTION public.title_submission_readiness(_title_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_title text;
  t_meta jsonb;
  has_film boolean;
  has_trailer boolean;
  has_poster boolean;
  has_censor boolean;
  has_ownership boolean;
  missing text[] := ARRAY[]::text[];
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT owner_user_id, title, metadata
    INTO t_owner, t_title, t_meta
  FROM public.content_titles WHERE id = _title_id;

  IF t_owner IS NULL THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;
  IF t_owner <> uid AND NOT public.has_role(uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT
    bool_or(category IN ('feature_film')          AND is_primary),
    bool_or(category IN ('trailer')               AND is_primary),
    bool_or(category IN ('poster')                AND is_primary),
    bool_or(category IN ('censor_certificate','censor_cert') AND is_primary),
    bool_or(category IN ('ownership_documents','ownership')  AND is_primary)
  INTO has_film, has_trailer, has_poster, has_censor, has_ownership
  FROM public.title_assets WHERE title_id = _title_id;

  IF NOT COALESCE(t_title <> '', false)            THEN missing := missing || 'Title name'; END IF;
  IF NOT COALESCE(length(t_meta->>'synopsis') > 0, false)
                                                    THEN missing := missing || 'Synopsis'; END IF;
  IF NOT COALESCE(has_film, false)                  THEN missing := missing || 'Feature Film'; END IF;
  IF NOT COALESCE(has_trailer, false)               THEN missing := missing || 'Trailer'; END IF;
  IF NOT COALESCE(has_poster, false)                THEN missing := missing || 'Poster'; END IF;
  IF NOT COALESCE(has_censor, false)                THEN missing := missing || 'Censor Certificate'; END IF;
  IF NOT COALESCE(has_ownership, false)             THEN missing := missing || 'Ownership Documents'; END IF;

  RETURN jsonb_build_object(
    'ready', array_length(missing, 1) IS NULL,
    'missing', to_jsonb(missing),
    'has', jsonb_build_object(
      'feature_film', COALESCE(has_film,false),
      'trailer', COALESCE(has_trailer,false),
      'poster', COALESCE(has_poster,false),
      'censor_certificate', COALESCE(has_censor,false),
      'ownership_documents', COALESCE(has_ownership,false)
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.title_submission_readiness(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.title_submission_readiness(uuid) TO authenticated;

-- =========================================================================
-- 5. RPC: submit_title_to_admin — enforces checklist, sets submitted+locked
-- =========================================================================
CREATE OR REPLACE FUNCTION public.submit_title_to_admin(
  _title_id uuid,
  _note     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_status public.content_status;
  t_workspace uuid;
  readiness jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT owner_user_id, status, workspace_id
    INTO t_owner, t_status, t_workspace
  FROM public.content_titles WHERE id = _title_id;

  IF t_owner IS NULL THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;
  IF t_owner <> uid AND NOT public.has_role(uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF t_status NOT IN ('draft','incomplete','changes_requested') THEN
    RAISE EXCEPTION 'Only drafts can be submitted (current: %)', t_status USING ERRCODE = '22023';
  END IF;

  readiness := public.title_submission_readiness(_title_id);
  IF (readiness->>'ready')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Title not ready for submission: %', readiness->>'missing' USING ERRCODE = '22023';
  END IF;

  UPDATE public.content_titles
     SET status       = 'submitted',
         submitted_at = now(),
         locked       = true,
         locked_at    = now(),
         locked_by    = uid,
         updated_at   = now()
   WHERE id = _title_id;

  INSERT INTO public.content_approvals (title_id, actor_user_id, from_status, to_status, note)
  VALUES (_title_id, uid, t_status, 'submitted', _note);

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, target_user_id, target_email, action, details
  )
  VALUES (
    uid,
    (SELECT email FROM auth.users WHERE id = uid),
    t_owner,
    (SELECT email FROM auth.users WHERE id = t_owner),
    'title_submitted',
    jsonb_build_object(
      'actor_user_id', uid,
      'organization_id', t_workspace,
      'title_id', _title_id,
      'from_status', t_status,
      'to_status', 'submitted',
      'created_at', now()
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_title_to_admin(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_title_to_admin(uuid, text) TO authenticated;
