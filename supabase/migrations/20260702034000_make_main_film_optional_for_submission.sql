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
    bool_or(category IN ('feature_film') AND is_primary),
    bool_or(category IN ('trailer') AND is_primary),
    bool_or(category IN ('poster') AND is_primary),
    bool_or(category IN ('censor_certificate','censor_cert') AND is_primary),
    bool_or(category IN ('ownership_documents','ownership') AND is_primary)
  INTO has_film, has_trailer, has_poster, has_censor, has_ownership
  FROM public.title_assets WHERE title_id = _title_id;

  IF NOT COALESCE(t_title <> '', false) THEN missing := missing || 'Title name'; END IF;
  IF NOT COALESCE(length(t_meta->>'synopsis') > 0, false) THEN missing := missing || 'Synopsis'; END IF;
  IF NOT COALESCE(has_trailer, false) THEN missing := missing || 'Trailer'; END IF;
  IF NOT COALESCE(has_poster, false) THEN missing := missing || 'Poster'; END IF;
  IF NOT COALESCE(has_censor, false) THEN missing := missing || 'Censor Certificate'; END IF;
  IF NOT COALESCE(has_ownership, false) THEN missing := missing || 'Ownership Documents'; END IF;

  RETURN jsonb_build_object(
    'ready', array_length(missing, 1) IS NULL,
    'missing', to_jsonb(missing),
    'has', jsonb_build_object(
      'feature_film', COALESCE(has_film, false),
      'trailer', COALESCE(has_trailer, false),
      'poster', COALESCE(has_poster, false),
      'censor_certificate', COALESCE(has_censor, false),
      'ownership_documents', COALESCE(has_ownership, false)
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.title_submission_readiness(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.title_submission_readiness(uuid) TO authenticated;
