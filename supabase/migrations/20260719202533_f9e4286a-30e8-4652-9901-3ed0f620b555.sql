
CREATE OR REPLACE FUNCTION public.recalc_workspace_storage_usage(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ru_bytes    bigint := 0;
  sa_orphan_bytes bigint := 0;
  total_bytes bigint := 0;
  resolved_ws uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  resolved_ws := public.resolve_user_workspace(_user_id);

  SELECT COALESCE(SUM(file_size),0)::bigint INTO ru_bytes
    FROM public.recent_uploads
   WHERE user_id = _user_id AND status IN ('uploaded','verified');

  SELECT COALESCE(SUM(total_size_bytes),0)::bigint INTO sa_orphan_bytes
    FROM public.studio_assets
   WHERE owner_id = _user_id AND primary_upload_id IS NULL;

  total_bytes := ru_bytes + sa_orphan_bytes;

  INSERT INTO public.workspace_storage_usage (user_id, workspace_id, active_bytes, archived_bytes, display_used_bytes, billable_bytes, last_recalculated_at)
  VALUES (_user_id, resolved_ws, total_bytes, 0, total_bytes, total_bytes, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active_bytes = EXCLUDED.active_bytes,
        display_used_bytes = EXCLUDED.display_used_bytes,
        billable_bytes = EXCLUDED.billable_bytes,
        workspace_id = COALESCE(public.workspace_storage_usage.workspace_id, EXCLUDED.workspace_id),
        last_recalculated_at = now(),
        updated_at = now();
END $function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.workspace_storage_usage WHERE user_id IS NOT NULL LOOP
    PERFORM public.recalc_workspace_storage_usage(r.user_id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_ingest_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q jsonb;
  owner uuid;
BEGIN
  owner := COALESCE(NEW.created_by, auth.uid());
  IF owner IS NULL OR COALESCE(NEW.total_bytes,0) <= 0 THEN
    RETURN NEW;
  END IF;
  q := public.assert_storage_quota(owner, NEW.total_bytes);
  IF (q->>'allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Storage quota exceeded: ingest job of % bytes would push usage to % GB of % GB plan limit.',
      NEW.total_bytes, q->>'would_use_gb', q->>'total_gb'
      USING ERRCODE = '53400',
            HINT = 'Upgrade storage plan or purchase a top-up before ingesting more data.';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_storage_quota_ingest_jobs ON public.ingest_jobs;
CREATE TRIGGER trg_enforce_storage_quota_ingest_jobs
  BEFORE INSERT ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_ingest_jobs();

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_upload_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  q jsonb;
  owner uuid;
BEGIN
  owner := COALESCE(NEW.user_id, auth.uid());
  IF owner IS NULL OR COALESCE(NEW.file_size,0) <= 0 THEN
    RETURN NEW;
  END IF;
  q := public.assert_storage_quota(owner, NEW.file_size);
  IF (q->>'allowed')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Storage quota exceeded: upload of % bytes would push usage to % GB of % GB plan limit.',
      NEW.file_size, q->>'would_use_gb', q->>'total_gb'
      USING ERRCODE = '53400',
            HINT = 'Upgrade storage plan or purchase a top-up before uploading more data.';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_storage_quota_upload_sessions ON public.upload_sessions;
CREATE TRIGGER trg_enforce_storage_quota_upload_sessions
  BEFORE INSERT ON public.upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_upload_sessions();
