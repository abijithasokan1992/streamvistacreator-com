
-- ============================================================
-- Phase 2A: include PAYG topup allocations in paid_storage_gb
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_workspace_storage_entitlement(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent public.workspace_storage_entitlements%ROWTYPE;
  sub_paid_gb numeric := 0;
  alloc_paid_gb numeric := 0;
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

  -- Recurring storage add-on subscriptions (TB → GB)
  SELECT COALESCE(SUM(storage_quantity_tb),0) * 1024
    INTO sub_paid_gb
    FROM public.subscriptions
   WHERE user_id = _user_id AND status IN ('active','trialing');

  -- One-time PAYG top-up allocations (already in GB)
  SELECT COALESCE(SUM(allocated_gb),0)
    INTO alloc_paid_gb
    FROM public.storage_allocations
   WHERE user_id = _user_id AND source = 'creator_payg';

  live_paid_gb := COALESCE(sub_paid_gb,0) + COALESCE(alloc_paid_gb,0);

  IF live_paid_gb IS DISTINCT FROM ent.paid_storage_gb THEN
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

-- ============================================================
-- Phase 2B: enforce title section locks at the database
-- ============================================================
-- Helper: returns true when caller is allowed to write the title even if locked.
CREATE OR REPLACE FUNCTION public.title_write_allowed(_title_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_locked boolean;
  has_unlock boolean;
BEGIN
  -- Backend / service-role writes (no auth.uid()) are always allowed.
  IF auth.uid() IS NULL THEN RETURN true; END IF;
  -- Admins bypass.
  IF public.has_role(auth.uid(),'admin') THEN RETURN true; END IF;

  SELECT COALESCE(ls.is_locked,false) INTO is_locked
    FROM public.title_lock_state ls WHERE ls.title_id = _title_id;
  IF NOT COALESCE(is_locked,false) THEN RETURN true; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.title_section_unlocks u
     WHERE u.title_id = _title_id
       AND u.status = 'open'
       AND (u.expires_at IS NULL OR u.expires_at > now())
       AND u.closed_at IS NULL
  ) INTO has_unlock;

  RETURN COALESCE(has_unlock,false);
END $$;
GRANT EXECUTE ON FUNCTION public.title_write_allowed(uuid) TO authenticated, service_role;

-- Trigger function for content_titles UPDATE
CREATE OR REPLACE FUNCTION public.enforce_title_lock_on_titles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.title_write_allowed(NEW.id) THEN
    RAISE EXCEPTION 'Title is locked. Request an edit unlock before saving changes.'
      USING ERRCODE='check_violation', HINT='LOCKED_TITLE';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_title_lock_on_titles ON public.content_titles;
CREATE TRIGGER trg_enforce_title_lock_on_titles
  BEFORE UPDATE ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_title_lock_on_titles();

-- Trigger function for title_assets INSERT/UPDATE/DELETE
CREATE OR REPLACE FUNCTION public.enforce_title_lock_on_assets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
BEGIN
  tid := COALESCE(NEW.title_id, OLD.title_id);
  IF tid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF NOT public.title_write_allowed(tid) THEN
    RAISE EXCEPTION 'Title is locked. Request an edit unlock before changing assets.'
      USING ERRCODE='check_violation', HINT='LOCKED_TITLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_enforce_title_lock_on_assets ON public.title_assets;
CREATE TRIGGER trg_enforce_title_lock_on_assets
  BEFORE INSERT OR UPDATE OR DELETE ON public.title_assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_title_lock_on_assets();
