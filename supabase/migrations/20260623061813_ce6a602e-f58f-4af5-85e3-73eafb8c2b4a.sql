
-- ============================================================
-- Testing-mode storage override layer
-- Adds a clean, reversible 50 GB testing allowance for QA across
-- creator / studio / buyer roles without touching real commercial logic.
-- ============================================================

-- 1) Seed (or refresh) the testing override config in platform_settings.
INSERT INTO public.platform_settings (key, value, category, description)
VALUES (
  'testing_storage_override',
  jsonb_build_object(
    'enabled', true,
    'default_gb', 50,
    'creator_gb', 50,
    'studio_gb', 50,
    'buyer_gb', 50,
    'note', 'Internal QA allowance. Set enabled=false to revert to real commercial entitlement.'
  ),
  'testing',
  'Temporary internal QA storage override. Disable before commercial launch.'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    updated_at = now();

-- 2) Allow all authenticated users to read this single testing-mode row
--    so the entitlement RPC's SECURITY DEFINER context can compute totals.
--    The row itself contains no sensitive data; it is operational config.
DROP POLICY IF EXISTS "ps_testing_override_read" ON public.platform_settings;
CREATE POLICY "ps_testing_override_read"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (key = 'testing_storage_override');

-- 3) Update entitlement resolver to include testing_override_gb.
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

  -- ---- Testing-mode override layer ----
  SELECT value INTO testing_cfg
    FROM public.platform_settings
   WHERE key = 'testing_storage_override';

  testing_enabled := COALESCE((testing_cfg->>'enabled')::boolean, false);

  IF testing_enabled THEN
    -- Pick the highest-priority role the user holds: studio > creator > buyer.
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
      -- Authenticated user with no recognised role (e.g. fresh signup) still gets default.
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
END $$;

GRANT EXECUTE ON FUNCTION public.get_workspace_storage_entitlement(uuid) TO authenticated, service_role;
