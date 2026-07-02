DROP POLICY IF EXISTS billing_pmc_customer_read_enabled ON public.billing_payment_method_configs;

CREATE POLICY billing_pmc_customer_read_for_active_order
  ON public.billing_payment_method_configs
  FOR SELECT
  TO authenticated
  USING (
    is_enabled = true
    AND EXISTS (
      SELECT 1
      FROM public.billing_orders bo
      WHERE bo.customer_user_id = auth.uid()
        AND bo.status IN ('awaiting_payment', 'payment_under_review')
    )
  );