
CREATE OR REPLACE FUNCTION public.recalc_workspace_storage_usage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ru_bytes    bigint := 0;
  sa_bytes    bigint := 0;
  total_bytes bigint := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;

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

  INSERT INTO public.workspace_storage_usage (user_id, active_bytes, archived_bytes, display_used_bytes, billable_bytes, last_recalculated_at)
  VALUES (_user_id, total_bytes, 0, total_bytes, total_bytes, now())
  ON CONFLICT (user_id) DO UPDATE
    SET active_bytes = EXCLUDED.active_bytes,
        display_used_bytes = EXCLUDED.display_used_bytes,
        billable_bytes = EXCLUDED.billable_bytes,
        last_recalculated_at = now(),
        updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.recalc_workspace_storage_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_workspace_storage_usage(uuid) TO authenticated, service_role;

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

  IF testing_enabled THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'studio') THEN
      role_key := 'studio';
      testing_gb := COALESCE((testing_cfg->>'studio_gb')::numeric, (testing_cfg->>'default_gb')::numeric, 0);
    ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('creator','content_owner','executive_producer')) THEN
      role_key := 'creator';
      testing_gb := COALESCE((testing_cfg->>'creator_gb')::numeric, (testing_cfg->>'default_gb')::numeric, 0);
    ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('buyer','client')) THEN
      role_key := 'buyer';
      testing_gb := COALESCE((testing_cfg->>'buyer_gb')::numeric, (testing_cfg->>'default_gb')::numeric, 0);
    ELSE
      testing_gb := COALESCE((testing_cfg->>'default_gb')::numeric, 0);
    END IF;
  END IF;

  total_gb := COALESCE(ent.included_storage_gb,0)
            + COALESCE(ent.paid_storage_gb,0)
            + COALESCE(ent.admin_bonus_storage_gb,0)
            + COALESCE(testing_gb,0);

  RETURN jsonb_build_object(
    'user_id', ent.user_id,
    'plan_code', ent.plan_code,
    'included_storage_gb', ent.included_storage_gb,
    'paid_storage_gb', ent.paid_storage_gb,
    'admin_bonus_storage_gb', ent.admin_bonus_storage_gb,
    'testing_override_gb', COALESCE(testing_gb,0),
    'testing_mode_enabled', testing_enabled,
    'testing_role_key', role_key,
    'total_storage_gb', total_gb,
    'storage_addon_blocks', ent.storage_addon_blocks,
    'warning_threshold_pct', ent.warning_threshold_pct,
    'urgent_threshold_pct', ent.urgent_threshold_pct,
    'hard_stop_threshold_pct', ent.hard_stop_threshold_pct,
    'billing_status', ent.billing_status,
    'used_bytes', used_bytes,
    'used_gb', ROUND((used_bytes::numeric / (1024*1024*1024))::numeric, 4),
    'usage_pct', CASE WHEN total_gb > 0
                      THEN LEAST(100, ROUND(((used_bytes::numeric / (1024*1024*1024)) / total_gb) * 100, 2))
                      ELSE 0 END
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_workspace_storage_entitlement(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_workspace_storage_entitlement(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.trg_storage_recalc_from_recent_uploads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_workspace_storage_usage(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.trg_storage_recalc_from_studio_assets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_workspace_storage_usage(COALESCE(NEW.owner_id, OLD.owner_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_recent_uploads_storage_recalc ON public.recent_uploads;
CREATE TRIGGER trg_recent_uploads_storage_recalc
AFTER INSERT OR UPDATE OF file_size, status OR DELETE ON public.recent_uploads
FOR EACH ROW EXECUTE FUNCTION public.trg_storage_recalc_from_recent_uploads();

DROP TRIGGER IF EXISTS trg_studio_assets_storage_recalc ON public.studio_assets;
CREATE TRIGGER trg_studio_assets_storage_recalc
AFTER INSERT OR UPDATE OF total_size_bytes OR DELETE ON public.studio_assets
FOR EACH ROW EXECUTE FUNCTION public.trg_storage_recalc_from_studio_assets();

DO $$
DECLARE u uuid;
BEGIN
  FOR u IN
    SELECT uid FROM (
      SELECT DISTINCT user_id AS uid FROM public.recent_uploads WHERE user_id IS NOT NULL
      UNION
      SELECT DISTINCT owner_id AS uid FROM public.studio_assets WHERE owner_id IS NOT NULL
    ) s
  LOOP
    PERFORM public.recalc_workspace_storage_usage(u);
  END LOOP;
END $$;

UPDATE public.platform_settings
   SET value = jsonb_set(value, '{enabled}', to_jsonb(false)),
       updated_at = now()
 WHERE key = 'testing_storage_override';
