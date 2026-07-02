DROP POLICY IF EXISTS billing_pmc_read ON public.billing_payment_method_configs;
DROP POLICY IF EXISTS billing_pmc_customer_read_enabled ON public.billing_payment_method_configs;
DROP POLICY IF EXISTS billing_pmc_customer_read_for_active_order ON public.billing_payment_method_configs;

ALTER TABLE public.billing_payment_method_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_pmc_admin_read ON public.billing_payment_method_configs;
CREATE POLICY billing_pmc_admin_read
  ON public.billing_payment_method_configs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
  );

REVOKE SELECT ON public.billing_payment_method_configs FROM anon;
REVOKE ALL    ON public.billing_payment_method_configs FROM PUBLIC;

GRANT SELECT ON public.billing_payment_method_configs TO authenticated;
GRANT ALL    ON public.billing_payment_method_configs TO service_role;