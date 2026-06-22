
CREATE OR REPLACE FUNCTION public.get_workspace_storage_entitlement(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent public.workspace_storage_entitlements%ROWTYPE;
  live_paid_gb numeric := 0;
  used_bytes bigint := 0;
  legacy_used_mb numeric := 0;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO ent FROM public.workspace_storage_entitlements WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.workspace_storage_entitlements (user_id, plan_code, included_storage_gb)
    VALUES (_user_id, 'creator_basic', 5)
    RETURNING * INTO ent;
  END IF;

  -- Always re-sync paid_storage_gb from active subscriptions (the source of truth for purchases).
  SELECT COALESCE(SUM(storage_quantity_tb),0) * 1024
    INTO live_paid_gb
    FROM public.subscriptions
   WHERE user_id = _user_id AND status IN ('active','trialing');

  IF live_paid_gb IS DISTINCT FROM ent.paid_storage_gb
     OR FLOOR(live_paid_gb/1024)::int IS DISTINCT FROM ent.storage_addon_blocks THEN
    UPDATE public.workspace_storage_entitlements
       SET paid_storage_gb = COALESCE(live_paid_gb,0),
           storage_addon_blocks = FLOOR(COALESCE(live_paid_gb,0)/1024)::int,
           updated_at = now()
     WHERE user_id = _user_id
    RETURNING * INTO ent;
  END IF;

  SELECT display_used_bytes INTO used_bytes FROM public.workspace_storage_usage WHERE user_id = _user_id;
  IF used_bytes IS NULL THEN
    SELECT COALESCE(storage_used_mb,0) INTO legacy_used_mb FROM public.user_profiles WHERE user_id = _user_id;
    used_bytes := (legacy_used_mb * 1024 * 1024)::bigint;
  END IF;

  RETURN jsonb_build_object(
    'user_id', ent.user_id,
    'plan_code', ent.plan_code,
    'included_storage_gb', ent.included_storage_gb,
    'paid_storage_gb', ent.paid_storage_gb,
    'admin_bonus_storage_gb', ent.admin_bonus_storage_gb,
    'total_storage_gb', ent.total_storage_gb,
    'storage_addon_blocks', ent.storage_addon_blocks,
    'warning_threshold_pct', ent.warning_threshold_pct,
    'urgent_threshold_pct', ent.urgent_threshold_pct,
    'hard_stop_threshold_pct', ent.hard_stop_threshold_pct,
    'billing_status', ent.billing_status,
    'used_bytes', used_bytes,
    'used_gb', ROUND((used_bytes::numeric / (1024*1024*1024))::numeric, 4),
    'usage_pct', CASE WHEN ent.total_storage_gb > 0
                      THEN LEAST(100, ROUND(((used_bytes::numeric / (1024*1024*1024)) / ent.total_storage_gb) * 100, 2))
                      ELSE 0 END
  );
END $$;

CREATE OR REPLACE FUNCTION public.assert_storage_quota(_user_id uuid, _add_bytes bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  total_gb numeric;
  used_gb numeric;
  would_gb numeric;
  hard_pct integer;
BEGIN
  payload := public.get_workspace_storage_entitlement(_user_id);
  total_gb := (payload->>'total_storage_gb')::numeric;
  used_gb := (payload->>'used_gb')::numeric;
  hard_pct := COALESCE((payload->>'hard_stop_threshold_pct')::int, 100);
  would_gb := used_gb + (COALESCE(_add_bytes,0)::numeric / (1024*1024*1024));

  RETURN jsonb_build_object(
    'allowed', (total_gb > 0 AND (would_gb / total_gb) * 100 <= hard_pct),
    'total_gb', total_gb,
    'used_gb', used_gb,
    'would_use_gb', would_gb,
    'hard_stop_pct', hard_pct
  );
END $$;
GRANT EXECUTE ON FUNCTION public.assert_storage_quota(uuid, bigint) TO authenticated, service_role;
