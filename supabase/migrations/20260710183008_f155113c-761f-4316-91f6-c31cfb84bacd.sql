
-- ============================================================================
-- Ingest → Media CMS auto-sync (reuses existing schema only)
-- ============================================================================

-- Helper: derive container from mime type (immutable so it can be reused)
CREATE OR REPLACE FUNCTION public._mediacms_container_from_mime(m text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN m ILIKE 'video/mp4'          THEN 'mp4'
    WHEN m ILIKE 'video/quicktime'    THEN 'mov'
    WHEN m ILIKE 'video/x-matroska'   THEN 'mkv'
    WHEN m ILIKE 'video/x-msvideo'    THEN 'avi'
    WHEN m ILIKE 'video/mpeg'         THEN 'mpeg'
    WHEN m ILIKE 'video/webm'         THEN 'webm'
    WHEN m ILIKE 'audio/mpeg'         THEN 'mp3'
    WHEN m ILIKE 'audio/wav'          THEN 'wav'
    WHEN m ILIKE 'audio/aac'          THEN 'aac'
    WHEN m ILIKE 'image/jpeg'         THEN 'jpeg'
    WHEN m ILIKE 'image/png'          THEN 'png'
    WHEN m ILIKE 'application/pdf'    THEN 'pdf'
    ELSE NULL
  END
$$;

-- Helper: derive version_type enum from category text
CREATE OR REPLACE FUNCTION public._mediacms_version_type_from_category(cat text)
RETURNS public.media_version_type LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(cat,''))
    WHEN 'feature_film' THEN 'master'::public.media_version_type
    WHEN 'trailer'      THEN 'trailer'::public.media_version_type
    WHEN 'screener'     THEN 'screener'::public.media_version_type
    ELSE                     'clip'::public.media_version_type
  END
$$;

-- Core sync: given a recent_uploads row, ensure studio_assets + title_media_versions
CREATE OR REPLACE FUNCTION public.sync_upload_to_media_cms(p_upload_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u                 public.recent_uploads%ROWTYPE;
  v_asset_id        uuid;
  v_title_id        uuid;
  v_title_exists    boolean;
  v_version_type    public.media_version_type;
  v_container       text;
  v_tmv_id          uuid;
  v_result          jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO u FROM public.recent_uploads WHERE id = p_upload_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'upload_not_found');
  END IF;

  -- Only sync terminal states
  IF u.status NOT IN ('verified','uploaded') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_terminal', 'status', u.status);
  END IF;

  ----------------------------------------------------------------------------
  -- 1. studio_assets: idempotent by primary_upload_id
  ----------------------------------------------------------------------------
  SELECT id INTO v_asset_id
  FROM public.studio_assets
  WHERE primary_upload_id = u.id
  LIMIT 1;

  IF v_asset_id IS NULL THEN
    INSERT INTO public.studio_assets (
      workspace_id, project_id, owner_id, title, asset_type,
      primary_upload_id, total_size_bytes, file_count, codec, status, metadata
    ) VALUES (
      u.workspace_id, u.project_id, u.user_id,
      coalesce(u.file_name, 'Untitled'),
      CASE
        WHEN u.mime_type ILIKE 'video/%' THEN 'clip'
        WHEN u.mime_type ILIKE 'audio/%' THEN 'audio'
        WHEN u.mime_type ILIKE 'image/%' THEN 'image'
        ELSE 'clip'
      END,
      u.id, coalesce(u.file_size, 0), 1,
      public._mediacms_container_from_mime(u.mime_type),
      'active',
      jsonb_build_object(
        'source', 'ingest_auto_sync',
        'mime_type', u.mime_type,
        'object_key', u.object_key,
        'bucket', u.bucket,
        'region', u.region,
        'category', u.category
      )
    )
    RETURNING id INTO v_asset_id;
  ELSE
    UPDATE public.studio_assets
    SET total_size_bytes = coalesce(u.file_size, total_size_bytes),
        codec = coalesce(codec, public._mediacms_container_from_mime(u.mime_type)),
        metadata = metadata || jsonb_build_object(
          'source', 'ingest_auto_sync',
          'mime_type', u.mime_type,
          'object_key', u.object_key,
          'last_synced_at', now()
        )
    WHERE id = v_asset_id;
  END IF;

  -- Link studio_asset_files (idempotent by unique (asset_id, upload_id))
  INSERT INTO public.studio_asset_files (asset_id, upload_id, role, sort_order)
  VALUES (v_asset_id, u.id, 'primary', 0)
  ON CONFLICT (asset_id, upload_id) DO NOTHING;

  v_result := jsonb_build_object('studio_asset_id', v_asset_id);

  ----------------------------------------------------------------------------
  -- 2. title_media_versions: derive title_id from object_key path
  ----------------------------------------------------------------------------
  v_title_id := (substring(u.object_key from '/titles/([0-9a-fA-F-]{36})/'))::uuid;

  IF v_title_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.content_titles WHERE id = v_title_id)
      INTO v_title_exists;

    IF v_title_exists THEN
      v_version_type := public._mediacms_version_type_from_category(u.category);
      v_container    := public._mediacms_container_from_mime(u.mime_type);

      -- Idempotency: dedupe by (title_id, source_asset_id)
      SELECT id INTO v_tmv_id
      FROM public.title_media_versions
      WHERE title_id = v_title_id
        AND source_asset_id = v_asset_id
      LIMIT 1;

      IF v_tmv_id IS NULL THEN
        INSERT INTO public.title_media_versions (
          title_id, version_type, label, source_asset_id,
          codec, container, tech_metadata
        ) VALUES (
          v_title_id, v_version_type,
          coalesce(u.file_name, v_version_type::text),
          v_asset_id,
          v_container, v_container,
          jsonb_build_object(
            'source', 'ingest_auto_sync',
            'upload_id', u.id,
            'object_key', u.object_key,
            'file_size', u.file_size,
            'mime_type', u.mime_type,
            'category', u.category,
            'bucket', u.bucket,
            'region', u.region
          )
        )
        RETURNING id INTO v_tmv_id;
      ELSE
        UPDATE public.title_media_versions
        SET codec = coalesce(codec, v_container),
            container = coalesce(container, v_container),
            tech_metadata = tech_metadata || jsonb_build_object(
              'upload_id', u.id,
              'object_key', u.object_key,
              'file_size', u.file_size,
              'mime_type', u.mime_type,
              'last_synced_at', now()
            )
        WHERE id = v_tmv_id;
      END IF;

      v_result := v_result || jsonb_build_object('title_media_version_id', v_tmv_id, 'title_id', v_title_id);
    ELSE
      v_result := v_result || jsonb_build_object('title_link', 'title_not_found', 'title_id', v_title_id);
    END IF;
  ELSE
    v_result := v_result || jsonb_build_object('title_link', 'no_title_in_path');
  END IF;

  RETURN jsonb_build_object('ok', true, 'upload_id', u.id) || v_result;
END $$;

REVOKE ALL ON FUNCTION public.sync_upload_to_media_cms(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_upload_to_media_cms(uuid) TO authenticated, service_role;

----------------------------------------------------------------------------
-- Trigger: fire after INSERT (rare terminal) or UPDATE (normal path)
----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_sync_upload_to_media_cms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('verified','uploaded')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM public.sync_upload_to_media_cms(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recent_uploads_media_cms_sync ON public.recent_uploads;
CREATE TRIGGER trg_recent_uploads_media_cms_sync
AFTER INSERT OR UPDATE OF status ON public.recent_uploads
FOR EACH ROW
EXECUTE FUNCTION public.tg_sync_upload_to_media_cms();

----------------------------------------------------------------------------
-- One-time backfill for existing terminal uploads
----------------------------------------------------------------------------
DO $backfill$
DECLARE
  r RECORD;
  n_synced int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.recent_uploads
    WHERE status IN ('verified','uploaded')
    ORDER BY created_at ASC
  LOOP
    PERFORM public.sync_upload_to_media_cms(r.id);
    n_synced := n_synced + 1;
  END LOOP;
  RAISE NOTICE 'ingest→media-cms backfill: % uploads processed', n_synced;
END $backfill$;
