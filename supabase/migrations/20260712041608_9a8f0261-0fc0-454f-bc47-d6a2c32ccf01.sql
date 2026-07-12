CREATE OR REPLACE FUNCTION public.title_removal_finalize_admin(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.title_removal_requests;
BEGIN
  -- service_role only — end-user JWT will have current_user='authenticated'
  IF current_user NOT IN ('service_role','supabase_admin','postgres') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO r FROM public.title_removal_requests
   WHERE id = _request_id AND status = 'purging';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state'; END IF;
  IF jsonb_array_length(r.failed_paths) <> 0 THEN RAISE EXCEPTION 'storage_not_empty'; END IF;

  DELETE FROM public.title_media_versions   WHERE title_id = r.title_id;
  DELETE FROM public.title_screening_assets WHERE title_id = r.title_id;
  DELETE FROM public.title_assets           WHERE title_id = r.title_id;
  DELETE FROM public.content_titles         WHERE id = r.title_id;

  UPDATE public.title_removal_requests
     SET status = 'purged', completed_at = now(), updated_at = now()
   WHERE id = _request_id;

  INSERT INTO public.title_removal_events (request_id, action, from_status, to_status, metadata)
  VALUES (_request_id, 'purge_complete', 'purging', 'purged',
          jsonb_build_object('file_count', r.file_count, 'total_bytes', r.total_bytes));

  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (NULL, 'title.permanent_removal.finalize', 'content_title', r.title_id,
          jsonb_build_object('request_id', _request_id,
                             'file_count', r.file_count,
                             'total_bytes', r.total_bytes));
END $$;

REVOKE ALL ON FUNCTION public.title_removal_finalize_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.title_removal_finalize_admin(uuid) TO service_role;
