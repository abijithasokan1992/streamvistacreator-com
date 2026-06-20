
-- 1. Roles
DO $$
BEGIN
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio_owner'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio_manager'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio_uploader'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio_reviewer'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio_archive_manager'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- 2. studio_vault_products
CREATE TABLE IF NOT EXISTS public.studio_vault_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  storage_class text NOT NULL CHECK (storage_class IN ('active_vault','catalog_vault','archive_vault')),
  description text,
  short_pitch text,
  badge text,
  sell_price_per_tb_paise bigint NOT NULL CHECK (sell_price_per_tb_paise > 0),
  internal_cost_per_tb_paise bigint NOT NULL DEFAULT 0,
  gst_percent numeric NOT NULL DEFAULT 18,
  min_tb integer NOT NULL DEFAULT 1,
  max_tb integer NOT NULL DEFAULT 200,
  default_tb_options jsonb NOT NULL DEFAULT '[1,5,12,25,50]'::jsonb,
  billing_modes jsonb NOT NULL DEFAULT '["monthly","quarterly","semiannual","annual"]'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  self_serve_enabled boolean NOT NULL DEFAULT true,
  enterprise_only boolean NOT NULL DEFAULT false,
  oci_storage_tier text,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.studio_vault_products TO anon, authenticated;
GRANT ALL ON public.studio_vault_products TO service_role;
ALTER TABLE public.studio_vault_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svp_public_read_visible" ON public.studio_vault_products
  FOR SELECT TO anon, authenticated
  USING (visible = true OR public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "svp_admin_all" ON public.studio_vault_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_svp_updated BEFORE UPDATE ON public.studio_vault_products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- Seed three default products
INSERT INTO public.studio_vault_products
  (code, name, storage_class, description, short_pitch, badge,
   sell_price_per_tb_paise, internal_cost_per_tb_paise, default_tb_options, sort_order, features)
VALUES
  ('active_vault','Active Vault','active_vault',
   'Hot storage for live productions, masters in motion, and current post-production workflow. Frequent reads and writes, instant access.',
   'For films currently in production and post.','Most popular',
   350000, 90000, '[1,5,12,25,50]'::jsonb, 10,
   '["Instant read/write","RAW footage & masters","Project files & deliverables","Team uploads","Suitable for proxy & QC workflows"]'::jsonb),
  ('catalog_vault','Catalog Vault','catalog_vault',
   'Warm storage for completed titles, studio catalog, and lower-touch assets that still need browsing and occasional retrieval.',
   'Your finished films, browseable and safe.',NULL,
   165000, 35000, '[5,12,25,50,100]'::jsonb, 20,
   '["Browseable catalog","Metadata-rich","Occasional retrieval","Lower cost per TB","Ideal for completed titles"]'::jsonb),
  ('archive_vault','Archive Vault','archive_vault',
   'Cold long-term archive for safety copies, disaster recovery, and legal retention. Restore-oriented, not for daily access.',
   'Off-site insurance copy for your library.','Best value',
   75000, 15000, '[12,25,50,100,250]'::jsonb, 30,
   '["Long-term preservation","Disaster recovery copy","Restore on request","Lowest cost per TB","Retention-grade durability"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 3. Extend storage_topups
ALTER TABLE public.storage_topups
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'creator_payg',
  ADD COLUMN IF NOT EXISTS vault_product_id uuid REFERENCES public.studio_vault_products(id),
  ADD COLUMN IF NOT EXISTS storage_class text,
  ADD COLUMN IF NOT EXISTS billing_interval_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_periods integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal_paise bigint,
  ADD COLUMN IF NOT EXISTS gst_paise bigint,
  ADD COLUMN IF NOT EXISTS total_paise bigint;

-- 4. Price calculator
CREATE OR REPLACE FUNCTION public.studio_vault_calculate_price(
  _product_id uuid, _tb integer, _months integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  p public.studio_vault_products%ROWTYPE;
  tb_int integer := GREATEST(1, COALESCE(_tb,1));
  months integer := COALESCE(_months,1);
  base_per_tb_per_month bigint;
  disc numeric := 0;
  subtotal bigint;
  gst bigint;
  total bigint;
BEGIN
  SELECT * INTO p FROM public.studio_vault_products WHERE id = _product_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Vault product not found' USING ERRCODE='P0002'; END IF;
  IF tb_int < p.min_tb OR tb_int > p.max_tb THEN
    RAISE EXCEPTION 'Quantity % TB is outside allowed range (% – % TB)', tb_int, p.min_tb, p.max_tb USING ERRCODE='22023';
  END IF;
  IF months NOT IN (1,3,6,12) THEN
    RAISE EXCEPTION 'Billing interval must be 1, 3, 6 or 12 months' USING ERRCODE='22023';
  END IF;
  base_per_tb_per_month := p.sell_price_per_tb_paise;
  disc := CASE months WHEN 3 THEN 0.05 WHEN 6 THEN 0.08 WHEN 12 THEN 0.12 ELSE 0 END;
  subtotal := round( base_per_tb_per_month::numeric * tb_int * months * (1 - disc) )::bigint;
  gst := round(subtotal * (p.gst_percent / 100.0))::bigint;
  total := subtotal + gst;
  RETURN jsonb_build_object(
    'product_id', p.id, 'product_code', p.code, 'product_name', p.name,
    'storage_class', p.storage_class, 'tb', tb_int, 'months', months,
    'base_per_tb_per_month_paise', base_per_tb_per_month,
    'discount_pct', (disc*100)::int,
    'subtotal_paise', subtotal, 'gst_paise', gst, 'gst_percent', p.gst_percent,
    'total_paise', total
  );
END$$;

GRANT EXECUTE ON FUNCTION public.studio_vault_calculate_price(uuid,integer,integer) TO anon, authenticated;

-- 5. Create vault purchase (pending topup row)
CREATE OR REPLACE FUNCTION public.studio_vault_create_topup(
  _product_id uuid, _tb integer, _months integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.studio_vault_products%ROWTYPE;
  priced jsonb;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO p FROM public.studio_vault_products WHERE id = _product_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Vault product not found' USING ERRCODE='P0002'; END IF;
  IF NOT p.visible OR NOT p.self_serve_enabled THEN
    RAISE EXCEPTION 'Vault product is not available for self-serve purchase' USING ERRCODE='42501';
  END IF;

  priced := public.studio_vault_calculate_price(_product_id, _tb, _months);

  INSERT INTO public.storage_topups (
    user_id, tb_added, amount_inr, status, source,
    vault_product_id, storage_class, billing_interval_months, billing_periods,
    subtotal_paise, gst_paise, total_paise
  ) VALUES (
    uid, _tb, (priced->>'total_paise')::bigint / 100.0, 'pending', 'studio_vault',
    p.id, p.storage_class, _months, _months,
    (priced->>'subtotal_paise')::bigint,
    (priced->>'gst_paise')::bigint,
    (priced->>'total_paise')::bigint
  ) RETURNING id INTO new_id;

  RETURN new_id;
END$$;

GRANT EXECUTE ON FUNCTION public.studio_vault_create_topup(uuid,integer,integer) TO authenticated;

-- 6. Admin upsert
CREATE OR REPLACE FUNCTION public.studio_vault_upsert_product(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pid uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  pid := NULLIF(_payload->>'id','')::uuid;
  IF pid IS NULL THEN
    INSERT INTO public.studio_vault_products(
      code, name, storage_class, description, short_pitch, badge,
      sell_price_per_tb_paise, internal_cost_per_tb_paise, gst_percent,
      min_tb, max_tb, default_tb_options, billing_modes, features,
      visible, self_serve_enabled, enterprise_only, oci_storage_tier, sort_order, created_by
    ) VALUES (
      _payload->>'code', _payload->>'name', _payload->>'storage_class',
      _payload->>'description', _payload->>'short_pitch', _payload->>'badge',
      COALESCE((_payload->>'sell_price_per_tb_paise')::bigint, 0),
      COALESCE((_payload->>'internal_cost_per_tb_paise')::bigint, 0),
      COALESCE((_payload->>'gst_percent')::numeric, 18),
      COALESCE((_payload->>'min_tb')::int, 1),
      COALESCE((_payload->>'max_tb')::int, 200),
      COALESCE(_payload->'default_tb_options','[1,5,12,25,50]'::jsonb),
      COALESCE(_payload->'billing_modes','["monthly","quarterly","semiannual","annual"]'::jsonb),
      COALESCE(_payload->'features','[]'::jsonb),
      COALESCE((_payload->>'visible')::boolean, true),
      COALESCE((_payload->>'self_serve_enabled')::boolean, true),
      COALESCE((_payload->>'enterprise_only')::boolean, false),
      _payload->>'oci_storage_tier',
      COALESCE((_payload->>'sort_order')::int, 100),
      uid
    ) RETURNING id INTO pid;
  ELSE
    UPDATE public.studio_vault_products SET
      name = COALESCE(_payload->>'name', name),
      description = COALESCE(_payload->>'description', description),
      short_pitch = COALESCE(_payload->>'short_pitch', short_pitch),
      badge = _payload->>'badge',
      sell_price_per_tb_paise = COALESCE((_payload->>'sell_price_per_tb_paise')::bigint, sell_price_per_tb_paise),
      internal_cost_per_tb_paise = COALESCE((_payload->>'internal_cost_per_tb_paise')::bigint, internal_cost_per_tb_paise),
      gst_percent = COALESCE((_payload->>'gst_percent')::numeric, gst_percent),
      min_tb = COALESCE((_payload->>'min_tb')::int, min_tb),
      max_tb = COALESCE((_payload->>'max_tb')::int, max_tb),
      default_tb_options = COALESCE(_payload->'default_tb_options', default_tb_options),
      billing_modes = COALESCE(_payload->'billing_modes', billing_modes),
      features = COALESCE(_payload->'features', features),
      visible = COALESCE((_payload->>'visible')::boolean, visible),
      self_serve_enabled = COALESCE((_payload->>'self_serve_enabled')::boolean, self_serve_enabled),
      enterprise_only = COALESCE((_payload->>'enterprise_only')::boolean, enterprise_only),
      oci_storage_tier = COALESCE(_payload->>'oci_storage_tier', oci_storage_tier),
      sort_order = COALESCE((_payload->>'sort_order')::int, sort_order),
      updated_at = now()
    WHERE id = pid;
  END IF;
  RETURN pid;
END$$;

GRANT EXECUTE ON FUNCTION public.studio_vault_upsert_product(jsonb) TO authenticated;

-- 7. Rewrite project_topup_entitlement to branch on source
CREATE OR REPLACE FUNCTION public.project_topup_entitlement(_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t          public.storage_topups%ROWTYPE;
  vp         public.studio_vault_products%ROWTYPE;
  creator_plan_id uuid;
  alloc_id   uuid;
  inv_row    public.invoices%ROWTYPE;
  user_email text;
  tb_int     int;
  gb_to_add  int;
  subtotal   bigint;
  gst        bigint;
  total      bigint;
  src        text;
BEGIN
  SELECT * INTO t FROM public.storage_topups WHERE id = _topup_id;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'topup % not found', _topup_id USING ERRCODE='P0002';
  END IF;
  IF t.status <> 'paid' THEN
    RAISE EXCEPTION 'topup % is not paid (status=%)', _topup_id, t.status USING ERRCODE='22023';
  END IF;

  src := COALESCE(t.source,'creator_payg');
  tb_int := GREATEST(1, COALESCE(t.tb_added,1)::int);
  gb_to_add := tb_int * 1024;
  SELECT email INTO user_email FROM auth.users WHERE id = t.user_id;

  IF src = 'studio_vault' AND t.vault_product_id IS NOT NULL THEN
    -- Studio Vault branch
    SELECT * INTO vp FROM public.studio_vault_products WHERE id = t.vault_product_id;

    -- Storage allocation, grouped by storage_class so each tier accumulates separately
    SELECT id INTO alloc_id
      FROM public.storage_allocations
     WHERE user_id = t.user_id AND source = 'studio_vault_'||vp.storage_class
     ORDER BY created_at ASC LIMIT 1;

    IF alloc_id IS NULL THEN
      INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, notes)
      VALUES (t.user_id, gb_to_add, 0, 'studio_vault_'||vp.storage_class,
              'Studio Vault '||vp.name||' — topup '||t.id);
    ELSE
      UPDATE public.storage_allocations
         SET allocated_gb = allocated_gb + gb_to_add, updated_at = now()
       WHERE id = alloc_id;
    END IF;

    -- Invoice
    SELECT * INTO inv_row FROM public.invoices WHERE topup_id = t.id LIMIT 1;
    IF inv_row.id IS NULL THEN
      subtotal := COALESCE(t.subtotal_paise, 0);
      gst      := COALESCE(t.gst_paise, 0);
      total    := COALESCE(t.total_paise, subtotal + gst);
      INSERT INTO public.invoices (
        user_id, plan_id, topup_id, source, description,
        subtotal_paise, gst_percent, gst_paise, total_paise,
        razorpay_order_id, razorpay_payment_id, billed_to_email
      ) VALUES (
        t.user_id, NULL, t.id, 'studio_vault',
        'Studio Vault — '||vp.name||' — '||tb_int||' TB × '||COALESCE(t.billing_interval_months,1)||' month(s)',
        subtotal, COALESCE(vp.gst_percent,18), gst, total,
        t.razorpay_order_id, t.razorpay_payment_id, user_email
      ) RETURNING * INTO inv_row;
    END IF;

    RETURN jsonb_build_object(
      'ok', true, 'source','studio_vault',
      'vault_product_id', vp.id, 'storage_class', vp.storage_class,
      'tb_added', tb_int, 'invoice_id', inv_row.id, 'invoice_number', inv_row.invoice_number
    );
  END IF;

  -- Creator pay-as-you-go branch (unchanged behaviour)
  SELECT id INTO creator_plan_id FROM public.plans WHERE code='creator_payg_1tb' LIMIT 1;
  IF creator_plan_id IS NULL THEN
    RAISE EXCEPTION 'creator_payg_1tb plan not seeded' USING ERRCODE='P0002';
  END IF;

  INSERT INTO public.plan_assignments (user_id, plan_id, status, starts_at, notes)
  VALUES (t.user_id, creator_plan_id, 'active', now(), 'auto: topup '||t.id)
  ON CONFLICT DO NOTHING;

  SELECT id INTO alloc_id
    FROM public.storage_allocations
   WHERE user_id = t.user_id AND source = 'creator_payg'
   ORDER BY created_at ASC LIMIT 1;

  IF alloc_id IS NULL THEN
    INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, notes)
    VALUES (t.user_id, gb_to_add, 0, 'creator_payg', 'auto: first topup '||t.id);
  ELSE
    UPDATE public.storage_allocations
       SET allocated_gb = allocated_gb + gb_to_add, updated_at = now()
     WHERE id = alloc_id;
  END IF;

  UPDATE public.user_profiles
     SET plan_tier = 'creator',
         topup_tb  = GREATEST(COALESCE(topup_tb,0), tb_int),
         updated_at = now()
   WHERE user_id = t.user_id;

  SELECT * INTO inv_row FROM public.invoices WHERE topup_id = t.id LIMIT 1;
  IF inv_row.id IS NULL THEN
    subtotal := 65000::bigint * tb_int;
    gst      := round(subtotal * 0.18)::bigint;
    total    := subtotal + gst;
    INSERT INTO public.invoices (
      user_id, plan_id, topup_id, source, description,
      subtotal_paise, gst_percent, gst_paise, total_paise,
      razorpay_order_id, razorpay_payment_id, billed_to_email
    ) VALUES (
      t.user_id, creator_plan_id, t.id, 'topup',
      'Creator Plan — '||tb_int||' TB storage (Pay-As-You-Go)',
      subtotal, 18, gst, total,
      t.razorpay_order_id, t.razorpay_payment_id, user_email
    ) RETURNING * INTO inv_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'source','creator_payg',
    'plan_id', creator_plan_id, 'tb_added', tb_int,
    'invoice_id', inv_row.id, 'invoice_number', inv_row.invoice_number
  );
END$$;
