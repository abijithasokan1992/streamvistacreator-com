
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS subscription_type text NOT NULL DEFAULT 'creator',
  ADD COLUMN IF NOT EXISTS storage_quantity_tb integer,
  ADD COLUMN IF NOT EXISTS unit_amount_paise integer,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_type_status
  ON public.subscriptions (user_id, subscription_type, status);

-- Effective storage entitlement, server-side.
-- Included 50 GB free + sum(storage_quantity_tb*1024) across ACTIVE storage subs + admin grants.
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
  monthly_paise integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_included int := 50;
  v_paid_tb int := 0;
  v_admin_gb int := 0;
  v_used_bytes numeric := 0;
  v_active_subs int := 0;
  v_monthly_paise int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF v_caller <> _user_id AND NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(SUM(COALESCE(storage_quantity_tb, 0)), 0),
         COUNT(*),
         COALESCE(SUM(COALESCE(unit_amount_paise, 0) * COALESCE(storage_quantity_tb, 1)), 0)
    INTO v_paid_tb, v_active_subs, v_monthly_paise
  FROM public.subscriptions
  WHERE user_id = _user_id
    AND subscription_type = 'creator_storage'
    AND status IN ('active','authenticated','charged','resumed');

  SELECT COALESCE(SUM(allocated_gb), 0)
    INTO v_admin_gb
  FROM public.storage_allocations
  WHERE user_id = _user_id
    AND (expires_at IS NULL OR expires_at > now());

  SELECT COALESCE(SUM(COALESCE(file_size, 0)), 0)::numeric
    INTO v_used_bytes
  FROM public.recent_uploads
  WHERE user_id = _user_id;

  included_gb := v_included;
  paid_tb := v_paid_tb;
  paid_gb := v_paid_tb * 1024;
  admin_gb := v_admin_gb;
  total_gb := v_included + paid_gb + v_admin_gb;
  used_gb := round((v_used_bytes / 1024.0 / 1024.0 / 1024.0)::numeric, 2);
  over_quota := used_gb > total_gb;
  active_storage_subscriptions := v_active_subs;
  monthly_paise := v_monthly_paise;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_creator_storage_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_creator_storage_entitlement(uuid) TO authenticated;
