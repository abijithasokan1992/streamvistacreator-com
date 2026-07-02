
-- 1. billing_config: add egress and archive policy knobs
ALTER TABLE public.billing_config
  ADD COLUMN IF NOT EXISTS egress_free_gb numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS egress_overage_rate_paise_per_gb integer NOT NULL DEFAULT 850,
  ADD COLUMN IF NOT EXISTS creator_basic_archive_after_days integer NOT NULL DEFAULT 30;

-- 2. recent_uploads: add inactivity + tier columns
ALTER TABLE public.recent_uploads
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS storage_tier text NOT NULL DEFAULT 'Standard';

CREATE INDEX IF NOT EXISTS idx_recent_uploads_tier_last_accessed
  ON public.recent_uploads(storage_tier, last_accessed_at);

-- 3. archive_jobs: admin read policy (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='archive_jobs'
      AND policyname='admins read all archive jobs'
  ) THEN
    CREATE POLICY "admins read all archive jobs"
      ON public.archive_jobs FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='restore_jobs'
      AND policyname='admins read all restore jobs'
  ) THEN
    CREATE POLICY "admins read all restore jobs"
      ON public.restore_jobs FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END$$;

-- 4. Find Creator Basic inactive raw masters
CREATE OR REPLACE FUNCTION public.compute_inactive_creator_basic_uploads(p_days integer DEFAULT NULL)
RETURNS TABLE (
  upload_id uuid,
  user_id uuid,
  workspace_id uuid,
  object_key text,
  bucket text,
  namespace text,
  region text,
  file_size bigint,
  last_accessed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cfg AS (
    SELECT COALESCE(p_days, creator_basic_archive_after_days, 30) AS days
    FROM public.billing_config WHERE id = 1
  ),
  basic_workspaces AS (
    SELECT DISTINCT e.workspace_id, e.user_id
    FROM public.workspace_storage_entitlements e
    WHERE e.plan_code = 'creator_basic'
      AND COALESCE(e.paid_storage_gb, 0) = 0
      AND COALESCE(e.admin_bonus_storage_gb, 0) = 0
  )
  SELECT
    ru.id, ru.user_id, ru.workspace_id, ru.object_key,
    ru.bucket, ru.namespace, ru.region, ru.file_size, ru.last_accessed_at
  FROM public.recent_uploads ru
  JOIN basic_workspaces bw ON bw.workspace_id = ru.workspace_id
  CROSS JOIN cfg
  WHERE COALESCE(ru.storage_tier, 'Standard') = 'Standard'
    AND COALESCE(ru.category, '') IN ('raw_master', 'master', 'raw')
    AND ru.status = 'completed'
    AND ru.last_accessed_at < now() - (cfg.days || ' days')::interval
  LIMIT 500;
$$;

-- 5. Enqueue an archive job (called by sweep edge function)
CREATE OR REPLACE FUNCTION public.enqueue_archive_job(
  p_upload_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_upload public.recent_uploads%ROWTYPE;
  v_job_id uuid;
BEGIN
  -- Only admin or service role may enqueue
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_upload FROM public.recent_uploads WHERE id = p_upload_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'upload not found'; END IF;

  -- Skip if already queued/running/done
  SELECT id INTO v_job_id
    FROM public.archive_jobs
   WHERE asset_id = p_upload_id
     AND status IN ('queued', 'running', 'completed')
   LIMIT 1;
  IF v_job_id IS NOT NULL THEN RETURN v_job_id; END IF;

  INSERT INTO public.archive_jobs (
    workspace_id, requested_by, asset_id,
    source_tier, target_tier, target_location,
    total_bytes, status, metadata
  ) VALUES (
    v_upload.workspace_id,
    COALESCE(auth.uid(), v_upload.user_id),
    p_upload_id,
    COALESCE(v_upload.storage_tier, 'Standard'),
    'Archive',
    v_upload.bucket || '/' || v_upload.object_key,
    COALESCE(v_upload.file_size, 0),
    'queued',
    jsonb_build_object(
      'reason', 'creator_basic_30d_inactive',
      'object_key', v_upload.object_key,
      'bucket', v_upload.bucket,
      'namespace', v_upload.namespace,
      'region', v_upload.region
    )
  ) RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- 6. Stage egress overage manual invoices
CREATE OR REPLACE FUNCTION public.stage_egress_overage_invoices(
  p_period date DEFAULT date_trunc('month', (now() - interval '1 day'))::date
)
RETURNS TABLE (user_id uuid, overage_gb numeric, invoice_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_gb numeric;
  v_rate_paise integer;
  v_user record;
  v_overage_gb numeric;
  v_amount_paise bigint;
  v_invoice_id uuid;
  v_invoice_number text;
  v_email text;
  v_name text;
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
  THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT egress_free_gb, egress_overage_rate_paise_per_gb
    INTO v_free_gb, v_rate_paise
    FROM public.billing_config WHERE id = 1;

  IF v_free_gb IS NULL THEN v_free_gb := 500; END IF;
  IF v_rate_paise IS NULL THEN v_rate_paise := 850; END IF;

  FOR v_user IN
    SELECT m.user_id, m.bandwidth_gb
      FROM public.usage_meters m
     WHERE m.period_start = p_period
       AND m.bandwidth_gb > v_free_gb
  LOOP
    v_overage_gb := round((v_user.bandwidth_gb - v_free_gb)::numeric, 2);
    v_amount_paise := (v_overage_gb * v_rate_paise)::bigint;

    -- Skip if already staged for this period
    IF EXISTS (
      SELECT 1 FROM public.manual_invoices
       WHERE user_id = v_user.user_id
         AND surface = 'egress_overage'
         AND notes LIKE '%' || to_char(p_period, 'YYYY-MM') || '%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT email, COALESCE(display_name, full_name, 'Customer')
      INTO v_email, v_name
      FROM public.user_profiles WHERE user_id = v_user.user_id;

    v_invoice_number := 'EG-' || to_char(p_period, 'YYYYMM') || '-' || substr(v_user.user_id::text, 1, 8);

    INSERT INTO public.manual_invoices (
      invoice_number, document_type, status, user_id, surface,
      line_items, currency, subtotal_paise, gst_percent, gst_paise, total_paise,
      tax_inclusive, due_date, notes, billed_to_name, billed_to_email
    ) VALUES (
      v_invoice_number, 'invoice', 'pending_review', v_user.user_id, 'egress_overage',
      jsonb_build_array(jsonb_build_object(
        'label', 'OCI egress overage (' || to_char(p_period, 'Mon YYYY') || ')',
        'quantity_gb', v_overage_gb,
        'rate_paise_per_gb', v_rate_paise,
        'amount_paise', v_amount_paise
      )),
      'INR',
      v_amount_paise,
      18,
      round(v_amount_paise * 0.18)::bigint,
      v_amount_paise + round(v_amount_paise * 0.18)::bigint,
      false,
      (p_period + interval '1 month' + interval '14 days')::date,
      'Auto-staged for ' || to_char(p_period, 'YYYY-MM') || '. Egress overage: ' || v_overage_gb || ' GB above ' || v_free_gb || ' GB free quota at ₹' || (v_rate_paise / 100.0) || '/GB.',
      v_name,
      v_email
    ) RETURNING id INTO v_invoice_id;

    user_id := v_user.user_id;
    overage_gb := v_overage_gb;
    invoice_id := v_invoice_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- 7. Read-only entitlement snapshot for /admin/operations
CREATE OR REPLACE FUNCTION public.get_workspace_entitlement_snapshot(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile jsonb;
  v_entitlement jsonb;
  v_subs jsonb;
  v_assignments jsonb;
  v_last_invoice jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT to_jsonb(up.*) - 'created_at' INTO v_profile
    FROM public.user_profiles up WHERE user_id = p_user_id;

  SELECT to_jsonb(e.*) INTO v_entitlement
    FROM public.workspace_storage_entitlements e
   WHERE user_id = p_user_id
   ORDER BY effective_from DESC NULLS LAST LIMIT 1;

  SELECT coalesce(jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at DESC), '[]'::jsonb) INTO v_subs
    FROM public.subscriptions s WHERE s.user_id = p_user_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'plan_id', pa.plan_id, 'status', pa.status,
    'starts_at', pa.starts_at, 'ends_at', pa.ends_at,
    'is_lifetime', pa.is_lifetime, 'is_promotional', pa.is_promotional,
    'plan_code', p.code, 'plan_name', p.name
  ) ORDER BY pa.starts_at DESC), '[]'::jsonb) INTO v_assignments
    FROM public.plan_assignments pa
    LEFT JOIN public.plans p ON p.id = pa.plan_id
   WHERE pa.user_id = p_user_id;

  SELECT to_jsonb(mi.*) INTO v_last_invoice
    FROM public.manual_invoices mi
   WHERE mi.user_id = p_user_id
   ORDER BY mi.created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'entitlement', v_entitlement,
    'subscriptions', v_subs,
    'plan_assignments', v_assignments,
    'last_invoice', v_last_invoice
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_inactive_creator_basic_uploads(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_archive_job(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stage_egress_overage_invoices(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_entitlement_snapshot(uuid) TO authenticated, service_role;

-- 8. pg_cron schedules (idempotent — drop+re-add)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN

    PERFORM cron.unschedule('sv-archive-sweep-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sv-archive-sweep-daily');
    PERFORM cron.unschedule('sv-egress-sweep-monthly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='sv-egress-sweep-monthly');

    PERFORM cron.schedule(
      'sv-archive-sweep-daily',
      '0 21 * * *',  -- 02:30 IST = 21:00 UTC prev day; close enough
      $cmd$
      SELECT net.http_post(
        url := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/archive-sweep',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('source','cron')
      );
      $cmd$
    );

    PERFORM cron.schedule(
      'sv-egress-sweep-monthly',
      '15 21 1 * *',  -- 1st of month, 02:45 IST
      $cmd$
      SELECT net.http_post(
        url := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/egress-sweep',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object('source','cron')
      );
      $cmd$
    );
  END IF;
END$$;
