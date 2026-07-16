
-- 1) BILLING ORDERS
DROP POLICY IF EXISTS "billing_orders_owner_insert_pending" ON public.billing_orders;
CREATE POLICY "billing_orders_owner_insert_pending"
ON public.billing_orders
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND customer_user_id = auth.uid()
  AND status IN ('draft'::billing_order_status, 'awaiting_payment'::billing_order_status)
  AND currency = 'INR'
);

CREATE OR REPLACE FUNCTION public.trg_billing_orders_paid_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'::billing_order_status
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.status::text,'') <> 'paid')
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'billing_orders.status=paid may only be set by service_role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_orders_paid_guard ON public.billing_orders;
CREATE TRIGGER trg_billing_orders_paid_guard
BEFORE INSERT OR UPDATE ON public.billing_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_billing_orders_paid_guard();

REVOKE ALL ON public.billing_orders FROM anon;

-- 2) Tenant isolation
ALTER TABLE public.hard_disk_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hdi_owner_isolation" ON public.hard_disk_intakes;
CREATE POLICY "hdi_owner_isolation"
ON public.hard_disk_intakes
FOR ALL TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "onboarding_requests_owner_isolation" ON public.onboarding_requests;
CREATE POLICY "onboarding_requests_owner_isolation"
ON public.onboarding_requests
FOR ALL TO authenticated
USING (submitter_user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()))
WITH CHECK (submitter_user_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()));

REVOKE ALL ON public.hard_disk_intakes FROM anon;
REVOKE ALL ON public.onboarding_requests FROM anon;

-- 3) Vault cost price
REVOKE SELECT (internal_cost_per_tb_paise) ON public.studio_vault_products FROM anon, authenticated;

CREATE OR REPLACE VIEW public.studio_vault_products_public
WITH (security_invoker = true)
AS
SELECT id, code, name, storage_class, description, short_pitch, badge,
       sell_price_per_tb_paise, gst_percent, min_tb, max_tb,
       default_tb_options, billing_modes, features, visible,
       self_serve_enabled, enterprise_only, oci_storage_tier, sort_order,
       created_at, updated_at
FROM public.studio_vault_products
WHERE visible = true;

GRANT SELECT ON public.studio_vault_products_public TO anon, authenticated;

-- 4) SECURITY DEFINER — revoke PUBLIC execute
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
  END LOOP;
END $$;

-- 5) Public-safe published titles
CREATE OR REPLACE VIEW public.published_titles
WITH (security_invoker = true)
AS
SELECT id, title, synopsis, published_at
FROM public.content_titles
WHERE status = 'published'::content_status AND published_at IS NOT NULL;

GRANT SELECT ON public.published_titles TO anon, authenticated;
