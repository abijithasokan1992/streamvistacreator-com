-- Tighten billing catalog read policies. Edge functions use service_role (unaffected).
-- No client code reads these tables directly.
DROP POLICY IF EXISTS billing_apps_read ON public.billing_apps;
CREATE POLICY billing_apps_admin_read ON public.billing_apps
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS billing_products_read ON public.billing_products;
CREATE POLICY billing_products_admin_read ON public.billing_products
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS billing_price_versions_read ON public.billing_price_versions;
CREATE POLICY billing_price_versions_admin_read ON public.billing_price_versions
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));