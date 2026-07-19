
-- =========================================================================
-- BUG 1: Stalled ingest job detector
-- =========================================================================

CREATE OR REPLACE FUNCTION public.mark_stalled_ingest_jobs(_stall_hours int DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jobs int := 0;
  v_items int := 0;
  v_cutoff timestamptz := now() - make_interval(hours => GREATEST(_stall_hours, 1));
BEGIN
  -- Mark queued items on stalled jobs as failed
  WITH stalled AS (
    SELECT id
      FROM public.ingest_jobs
     WHERE status IN ('uploading','scanning','retrying')
       AND updated_at < v_cutoff
       AND completed_files < total_files
  ),
  upd_items AS (
    UPDATE public.ingest_job_items i
       SET status = 'failed',
           error_message = COALESCE(i.error_message,
             'Stalled: no progress for ' || _stall_hours || 'h; likely client abandoned mid-upload'),
           updated_at = now()
      FROM stalled s
     WHERE i.job_id = s.id
       AND i.status IN ('queued','uploading','retrying')
    RETURNING 1
  )
  SELECT count(*) INTO v_items FROM upd_items;

  -- Mark jobs themselves failed
  WITH upd AS (
    UPDATE public.ingest_jobs
       SET status = 'failed',
           error_message = COALESCE(error_message,
             'Auto-failed: no progress for ' || _stall_hours || 'h. Client likely closed the browser mid-upload. Restart the ingest from the source to retry.'),
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
     WHERE status IN ('uploading','scanning','retrying')
       AND updated_at < v_cutoff
       AND completed_files < total_files
    RETURNING 1
  )
  SELECT count(*) INTO v_jobs FROM upd;

  RETURN jsonb_build_object(
    'stalled_jobs_failed', v_jobs,
    'stalled_items_failed', v_items,
    'stall_hours', _stall_hours,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_stalled_ingest_jobs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_stalled_ingest_jobs(int) TO service_role;

-- Extend global maintenance to include the stall detector.
CREATE OR REPLACE FUNCTION public.handle_global_platform_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uploads int := 0;
  v_emails  int := 0;
  v_legal   int := 0;
  v_stalled jsonb := '{}'::jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'insufficient_privilege: admin role required';
  END IF;

  WITH upd AS (
    UPDATE public.ingest_job_items
       SET status = 'queued',
           error_message = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'requeued_by_maintenance_at', now(),
                           'previous_error', error_message
                         ),
           updated_at = now()
     WHERE status = 'failed'
     RETURNING 1
  )
  SELECT count(*) INTO v_uploads FROM upd;

  WITH upd AS (
    UPDATE public.email_send_log
       SET status = 'pending',
           error_message = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'requeued_by_maintenance_at', now(),
                           'previous_error', error_message
                         )
     WHERE status = 'failed'
     RETURNING 1
  )
  SELECT count(*) INTO v_emails FROM upd;

  WITH upd AS (
    UPDATE public.content_titles ct
       SET status = 'legal_review'::content_status,
           updated_at = now()
     WHERE ct.status = 'legal_review'::content_status
       AND NOT EXISTS (
         SELECT 1 FROM public.title_review_assignments a
          WHERE a.title_id = ct.id AND a.stage = 'legal'
       )
     RETURNING 1
  )
  SELECT count(*) INTO v_legal FROM upd;

  v_stalled := public.mark_stalled_ingest_jobs(24);

  RETURN jsonb_build_object(
    'uploads_requeued', v_uploads,
    'emails_requeued',  v_emails,
    'legal_reviews_reset', v_legal,
    'stalled_ingest', v_stalled,
    'ran_at', now()
  );
END;
$$;

-- Hourly automatic sweep.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('mark_stalled_ingest_jobs_hourly')
     WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mark_stalled_ingest_jobs_hourly');
    PERFORM cron.schedule(
      'mark_stalled_ingest_jobs_hourly',
      '17 * * * *',
      $cron$ SELECT public.mark_stalled_ingest_jobs(24); $cron$
    );
  END IF;
END $$;

-- Fail the two currently stalled jobs right now.
SELECT public.mark_stalled_ingest_jobs(24);

-- =========================================================================
-- BUG 2: Populate workspace_id on entitlements & usage
-- =========================================================================

-- Helper: resolve a user's canonical workspace (oldest membership).
CREATE OR REPLACE FUNCTION public.resolve_user_workspace(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
    FROM public.workspace_members
   WHERE user_id = _user_id
   ORDER BY created_at ASC, workspace_id ASC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_user_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_workspace(uuid) TO authenticated, service_role;

-- Patch the entitlement fetcher to record workspace_id on creation.
CREATE OR REPLACE FUNCTION public.get_workspace_storage_entitlement(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ent public.workspace_storage_entitlements%ROWTYPE;
  sub_paid_gb numeric := 0;
  alloc_paid_gb numeric := 0;
  live_paid_gb numeric := 0;
  used_bytes bigint := 0;
  legacy_used_mb numeric := 0;
  testing_cfg jsonb;
  testing_enabled boolean := false;
  testing_gb numeric := 0;
  role_key text := 'creator';
  total_gb numeric := 0;
  resolved_ws uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  resolved_ws := public.resolve_user_workspace(_user_id);

  SELECT * INTO ent FROM public.workspace_storage_entitlements WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.workspace_storage_entitlements (user_id, workspace_id, plan_code, included_storage_gb)
    VALUES (_user_id, resolved_ws, 'creator_basic', 5)
    RETURNING * INTO ent;
  ELSIF ent.workspace_id IS NULL AND resolved_ws IS NOT NULL THEN
    UPDATE public.workspace_storage_entitlements
       SET workspace_id = resolved_ws, updated_at = now()
     WHERE user_id = _user_id
     RETURNING * INTO ent;
  END IF;

  SELECT COALESCE(SUM(storage_quantity_tb),0) * 1024
    INTO sub_paid_gb
    FROM public.subscriptions
   WHERE user_id = _user_id AND status IN ('active','trialing');

  SELECT COALESCE(SUM(allocated_gb),0)
    INTO alloc_paid_gb
    FROM public.storage_allocations
   WHERE user_id = _user_id
     AND (source = 'creator_payg' OR source LIKE 'studio_vault_%');

  live_paid_gb := COALESCE(sub_paid_gb,0) + COALESCE(alloc_paid_gb,0);

  IF live_paid_gb IS DISTINCT FROM ent.paid_storage_gb THEN
    UPDATE public.workspace_storage_entitlements
       SET paid_storage_gb = COALESCE(live_paid_gb,0),
           storage_addon_blocks = FLOOR(COALESCE(live_paid_gb,0)/1024)::int,
           updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO ent;
  END IF;

  PERFORM public.recalc_workspace_storage_usage(_user_id);

  SELECT display_used_bytes INTO used_bytes FROM public.workspace_storage_usage WHERE user_id = _user_id;
  IF used_bytes IS NULL THEN
    SELECT COALESCE(storage_used_mb,0) INTO legacy_used_mb FROM public.user_profiles WHERE user_id = _user_id;
    used_bytes := (legacy_used_mb * 1024 * 1024)::bigint;
  END IF;

  SELECT value INTO testing_cfg
    FROM public.platform_settings
   WHERE key = 'testing_storage_override';

  testing_enabled := COALESCE((testing_cfg->>'enabled')::boolean, false);
  testing_gb := COALESCE((testing_cfg->>'gb')::numeric, 0);

  total_gb := COALESCE(ent.total_storage_gb, ent.included_storage_gb + ent.paid_storage_gb + ent.admin_bonus_storage_gb);
  IF testing_enabled AND testing_gb > total_gb THEN
    total_gb := testing_gb;
  END IF;

  RETURN jsonb_build_object(
    'user_id', ent.user_id,
    'workspace_id', ent.workspace_id,
    'plan_code', ent.plan_code,
    'role_key', role_key,
    'included_storage_gb', ent.included_storage_gb,
    'paid_storage_gb', ent.paid_storage_gb,
    'admin_bonus_storage_gb', ent.admin_bonus_storage_gb,
    'total_storage_gb', total_gb,
    'total_bytes', (total_gb * 1073741824)::bigint,
    'used_bytes', used_bytes,
    'storage_addon_blocks', ent.storage_addon_blocks,
    'warning_threshold_pct', ent.warning_threshold_pct,
    'urgent_threshold_pct', ent.urgent_threshold_pct,
    'hard_stop_threshold_pct', ent.hard_stop_threshold_pct,
    'auto_expand_enabled', ent.auto_expand_enabled,
    'billing_status', ent.billing_status,
    'source', ent.source,
    'testing_override_applied', testing_enabled AND testing_gb > (ent.included_storage_gb + ent.paid_storage_gb + ent.admin_bonus_storage_gb)
  );
END;
$function$;

-- Patch usage recalc to record workspace_id.
CREATE OR REPLACE FUNCTION public.recalc_workspace_storage_usage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ru_bytes    bigint := 0;
  sa_bytes    bigint := 0;
  total_bytes bigint := 0;
  resolved_ws uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

  resolved_ws := public.resolve_user_workspace(_user_id);

  SELECT COALESCE(SUM(file_size),0)::bigint
    INTO ru_bytes
    FROM public.recent_uploads
   WHERE user_id = _user_id
     AND status IN ('uploaded','verified');

  SELECT COALESCE(SUM(total_size_bytes),0)::bigint
    INTO sa_bytes
    FROM public.studio_assets
   WHERE owner_id = _user_id;

  total_bytes := ru_bytes + sa_bytes;

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

-- Backfill existing NULL rows.
UPDATE public.workspace_storage_entitlements e
   SET workspace_id = public.resolve_user_workspace(e.user_id),
       updated_at = now()
 WHERE e.workspace_id IS NULL
   AND public.resolve_user_workspace(e.user_id) IS NOT NULL;

UPDATE public.workspace_storage_usage u
   SET workspace_id = public.resolve_user_workspace(u.user_id),
       updated_at = now()
 WHERE u.workspace_id IS NULL
   AND public.resolve_user_workspace(u.user_id) IS NOT NULL;
