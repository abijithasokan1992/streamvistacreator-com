
-- Drop the broad customer-facing SELECT policy on billing_payment_method_configs.
-- Any auth'd user could create an order and then read all bank/UPI rows.
DROP POLICY IF EXISTS billing_pmc_customer_read_for_active_order ON public.billing_payment_method_configs;

-- Replacement: SECURITY DEFINER function that returns PMC rows ONLY to the
-- caller who actually owns an order currently awaiting payment / review.
CREATE OR REPLACE FUNCTION public.get_payment_method_configs_for_my_order(_order_id uuid)
RETURNS TABLE (
  id uuid,
  rail text,
  display_name text,
  beneficiary_name text,
  bank_name text,
  account_number text,
  ifsc text,
  branch text,
  upi_id text,
  qr_image_path text,
  instructions text,
  support_contact text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.billing_orders bo
    WHERE bo.id = _order_id
      AND bo.customer_user_id = auth.uid()
      AND bo.status IN ('awaiting_payment', 'payment_under_review')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.rail, p.display_name, p.beneficiary_name, p.bank_name,
         p.account_number, p.ifsc, p.branch, p.upi_id, p.qr_image_path,
         p.instructions, p.support_contact
  FROM public.billing_payment_method_configs p
  WHERE p.is_enabled = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_payment_method_configs_for_my_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_method_configs_for_my_order(uuid) TO authenticated;
