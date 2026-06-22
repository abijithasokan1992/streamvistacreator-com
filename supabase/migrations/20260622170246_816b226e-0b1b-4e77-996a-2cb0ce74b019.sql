
CREATE OR REPLACE FUNCTION public.get_creator_storage_entitlement(_user_id uuid)
RETURNS TABLE (
  included_gb integer,
  paid_tb integer,
  paid_gb integer,
  admin_gb integer,
  total_gb integer,
  used_gb numeric,
  over_quota boolean,
  active_storage_subscriptions integer,
  monthly_paise integer,
  cancelling_tb integer,
  next_period_end timestamptz,
  halted_subscriptions integer,
  projected_total_gb_after_cancellations integer,
  projected_over_quota_after_cancellations boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_included int := 50;
  v_paid_tb int := 0;
  v_admin_gb int := 0;
  v_used_bytes numeric := 0;
  v_active_subs int := 0;
  v_monthly_paise int := 0;
  v_cancelling_tb int := 0;
  v_next_end timestamptz := NULL;
  v_halted int := 0;
  v_projected_gb int := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF v_caller <> _user_id AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(COALESCE(storage_quantity_tb,0)),0), COUNT(*),
         COALESCE(SUM(COALESCE(unit_amount_paise,0)*COALESCE(storage_quantity_tb,1)),0)
    INTO v_paid_tb, v_active_subs, v_monthly_paise
  FROM public.subscriptions
  WHERE user_id=_user_id AND subscription_type='creator_storage'
    AND status IN ('active','authenticated','charged','resumed');

  SELECT COALESCE(SUM(COALESCE(storage_quantity_tb,0)),0), MIN(current_period_end)
    INTO v_cancelling_tb, v_next_end
  FROM public.subscriptions
  WHERE user_id=_user_id AND subscription_type='creator_storage'
    AND status IN ('active','authenticated','charged','resumed')
    AND (cancel_at_period_end=true OR cancel_requested_at IS NOT NULL);

  SELECT COUNT(*) INTO v_halted
  FROM public.subscriptions
  WHERE user_id=_user_id AND subscription_type='creator_storage'
    AND status IN ('halted','paused');

  SELECT COALESCE(SUM(allocated_gb),0) INTO v_admin_gb
  FROM public.storage_allocations
  WHERE user_id=_user_id AND (expires_at IS NULL OR expires_at > now());

  SELECT COALESCE(SUM(COALESCE(file_size,0)),0)::numeric INTO v_used_bytes
  FROM public.recent_uploads WHERE user_id=_user_id;

  included_gb := v_included;
  paid_tb := v_paid_tb;
  paid_gb := v_paid_tb * 1024;
  admin_gb := v_admin_gb;
  total_gb := v_included + paid_gb + v_admin_gb;
  used_gb := round((v_used_bytes/1024.0/1024.0/1024.0)::numeric, 2);
  over_quota := used_gb > total_gb;
  active_storage_subscriptions := v_active_subs;
  monthly_paise := v_monthly_paise;
  cancelling_tb := v_cancelling_tb;
  next_period_end := v_next_end;
  halted_subscriptions := v_halted;
  v_projected_gb := total_gb - (v_cancelling_tb * 1024);
  projected_total_gb_after_cancellations := v_projected_gb;
  projected_over_quota_after_cancellations := used_gb > v_projected_gb;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_creator_storage_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_storage_entitlement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_creator_storage_risk()
RETURNS TABLE (
  user_id uuid, email text, full_name text, plan_tier text,
  used_gb numeric, total_gb integer, projected_total_gb integer,
  over_quota boolean, projected_over_quota boolean,
  active_blocks integer, cancelling_tb integer, halted_blocks integer,
  next_period_end timestamptz, monthly_paise integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT s.user_id FROM public.subscriptions s WHERE s.subscription_type='creator_storage'
    UNION
    SELECT DISTINCT ru.user_id FROM public.recent_uploads ru WHERE ru.user_id IS NOT NULL
  ),
  agg AS (
    SELECT c.user_id,
      (SELECT COALESCE(SUM(COALESCE(file_size,0)),0)::numeric/1024.0/1024.0/1024.0
         FROM public.recent_uploads ru WHERE ru.user_id=c.user_id) AS used_gb,
      (SELECT COALESCE(SUM(COALESCE(storage_quantity_tb,0)),0) FROM public.subscriptions s
         WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('active','authenticated','charged','resumed')) AS paid_tb,
      (SELECT COUNT(*) FROM public.subscriptions s
         WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('active','authenticated','charged','resumed')) AS active_blocks,
      (SELECT COALESCE(SUM(COALESCE(storage_quantity_tb,0)),0) FROM public.subscriptions s
         WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('active','authenticated','charged','resumed')
         AND (s.cancel_at_period_end=true OR s.cancel_requested_at IS NOT NULL)) AS cancelling_tb,
      (SELECT COUNT(*) FROM public.subscriptions s
         WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('halted','paused')) AS halted_blocks,
      (SELECT MIN(current_period_end) FROM public.subscriptions s
         WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('active','authenticated','charged','resumed')) AS next_period_end,
      (SELECT COALESCE(SUM(COALESCE(unit_amount_paise,0)*COALESCE(storage_quantity_tb,1)),0)
         FROM public.subscriptions s WHERE s.user_id=c.user_id AND s.subscription_type='creator_storage'
         AND s.status IN ('active','authenticated','charged','resumed')) AS monthly_paise,
      (SELECT COALESCE(SUM(allocated_gb),0) FROM public.storage_allocations sa
         WHERE sa.user_id=c.user_id AND (sa.expires_at IS NULL OR sa.expires_at > now())) AS admin_gb
    FROM candidates c
  )
  SELECT a.user_id, up.email::text, up.full_name::text, up.plan_tier::text,
    round(a.used_gb, 2),
    (50 + (a.paid_tb*1024) + a.admin_gb)::integer,
    (50 + (a.paid_tb*1024) + a.admin_gb - (a.cancelling_tb*1024))::integer,
    (a.used_gb > (50 + (a.paid_tb*1024) + a.admin_gb)),
    (a.used_gb > (50 + (a.paid_tb*1024) + a.admin_gb - (a.cancelling_tb*1024))),
    a.active_blocks::integer, a.cancelling_tb::integer, a.halted_blocks::integer,
    a.next_period_end, a.monthly_paise::integer
  FROM agg a
  LEFT JOIN public.user_profiles up ON up.user_id=a.user_id
  WHERE a.used_gb > 0 OR a.active_blocks > 0 OR a.halted_blocks > 0 OR a.cancelling_tb > 0
  ORDER BY
    (a.used_gb > (50 + (a.paid_tb*1024) + a.admin_gb)) DESC,
    (a.used_gb > (50 + (a.paid_tb*1024) + a.admin_gb - (a.cancelling_tb*1024))) DESC,
    a.halted_blocks DESC, a.used_gb DESC
  LIMIT 200;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_creator_storage_risk() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_creator_storage_risk() TO authenticated;
