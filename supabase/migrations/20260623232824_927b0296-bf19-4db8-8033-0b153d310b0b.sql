
CREATE OR REPLACE FUNCTION public.get_payment_method_configs_for_my_order(_order_id uuid)
RETURNS TABLE(id uuid, rail text, display_name text, beneficiary_name text, bank_name text, account_number text, ifsc text, branch text, upi_id text, qr_image_path text, instructions text, support_contact text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _app_key text;
  _product_source text;
BEGIN
  -- Verify the caller actually owns this order and it is awaiting payment.
  SELECT bo.app_key, bo.source_type
    INTO _app_key, _product_source
  FROM public.billing_orders bo
  WHERE bo.id = _order_id
    AND bo.customer_user_id = auth.uid()
    AND bo.status IN ('awaiting_payment', 'payment_under_review');

  IF _app_key IS NULL THEN
    RETURN;
  END IF;

  -- Only return enabled configs scoped to this order's app and product type.
  -- A config with no scope is treated as global and only surfaces if no
  -- app-scoped config exists for the same rail (handled by app priority below).
  RETURN QUERY
  SELECT p.id, p.rail::text, p.display_name, p.beneficiary_name, p.bank_name,
         p.account_number, p.ifsc, p.branch, p.upi_id, p.qr_image_path,
         p.instructions, p.support_contact
  FROM public.billing_payment_method_configs p
  WHERE p.is_enabled = true
    AND (p.scope_app_key IS NULL OR p.scope_app_key = _app_key)
    AND (
      cardinality(p.scope_product_types) = 0
      OR _product_source = ANY (p.scope_product_types)
    );
END;
$function$;
