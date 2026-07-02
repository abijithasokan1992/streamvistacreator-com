-- Tighten billing_payment_method_configs read access.
-- Sensitive financial details (account_number, ifsc, upi_id, etc.) must NOT
-- be readable by every authenticated user. Checkout-time exposure will be
-- handled by a server-side edge function in Stream 11.3B.

DROP POLICY IF EXISTS billing_pmc_read ON public.billing_payment_method_configs;

CREATE POLICY billing_pmc_admin_read
  ON public.billing_payment_method_configs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- service_role bypasses RLS but keep grants explicit for clarity.
REVOKE SELECT ON public.billing_payment_method_configs FROM anon;