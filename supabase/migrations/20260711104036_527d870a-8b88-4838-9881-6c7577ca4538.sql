
-- 1. billing_orders: only trusted backend can set amount/status/invoice
CREATE OR REPLACE FUNCTION public.guard_billing_orders_trusted_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
  v_is_trusted boolean := (current_user IN ('service_role','postgres','supabase_admin'))
                          OR v_jwt_role = 'service_role';
BEGIN
  IF v_is_trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Force safe defaults; clients cannot dictate money or status
    NEW.amount_subtotal_paise := 0;
    NEW.amount_tax_paise := 0;
    NEW.amount_total_paise := 0;
    NEW.status := 'awaiting_payment'::billing_order_status;
    NEW.invoice_id := NULL;
    NEW.payment_trace_id := NULL;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount_subtotal_paise IS DISTINCT FROM OLD.amount_subtotal_paise
       OR NEW.amount_tax_paise      IS DISTINCT FROM OLD.amount_tax_paise
       OR NEW.amount_total_paise    IS DISTINCT FROM OLD.amount_total_paise
       OR NEW.status                IS DISTINCT FROM OLD.status
       OR NEW.invoice_id            IS DISTINCT FROM OLD.invoice_id
       OR NEW.payment_trace_id      IS DISTINCT FROM OLD.payment_trace_id THEN
      RAISE EXCEPTION 'billing_orders.amount/status/invoice can only be modified by the trusted backend (payment webhook)'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_orders_guard_trusted ON public.billing_orders;
CREATE TRIGGER trg_billing_orders_guard_trusted
  BEFORE INSERT OR UPDATE ON public.billing_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_billing_orders_trusted_fields();

ALTER TABLE public.billing_orders FORCE ROW LEVEL SECURITY;

-- 2. billing_payment_method_configs (bank / IFSC / UPI): admin-only, force RLS
REVOKE ALL ON public.billing_payment_method_configs FROM PUBLIC;
REVOKE ALL ON public.billing_payment_method_configs FROM anon;
REVOKE ALL ON public.billing_payment_method_configs FROM authenticated;
GRANT ALL ON public.billing_payment_method_configs TO service_role;
ALTER TABLE public.billing_payment_method_configs FORCE ROW LEVEL SECURITY;

-- 3. studio_vault_products: revoke direct access; expose only the public view (no cost_price)
REVOKE ALL ON public.studio_vault_products FROM PUBLIC;
REVOKE ALL ON public.studio_vault_products FROM anon;
REVOKE ALL ON public.studio_vault_products FROM authenticated;
GRANT ALL ON public.studio_vault_products TO service_role;
ALTER TABLE public.studio_vault_products FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.studio_vault_products_public TO anon, authenticated;
COMMENT ON VIEW public.studio_vault_products_public IS
  'Customer-facing catalog. Intentionally excludes internal_cost_per_tb_paise. Base table studio_vault_products is admin-only.';
