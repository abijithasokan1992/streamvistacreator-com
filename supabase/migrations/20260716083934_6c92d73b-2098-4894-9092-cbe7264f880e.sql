
-- Server-side price validation for billing_orders INSERT to prevent client price tampering.
CREATE OR REPLACE FUNCTION public.enforce_billing_orders_insert_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected_total_paise BIGINT;
  v_expected_tax_paise   BIGINT;
  v_expected_sub_paise   BIGINT;
  v_gst_pct              NUMERIC;
BEGIN
  -- Service role & elevated roles bypass — webhooks and admin flows are trusted.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin'::app_role)
     OR public.has_role(auth.uid(), 'platform_owner'::app_role) THEN
    RETURN NEW;
  END IF;

  -- If the order references a product, recompute the authoritative total from
  -- the current active price version and reject mismatches.
  IF NEW.product_id IS NOT NULL THEN
    SELECT pv.total_paise, pv.tax_paise, pv.subtotal_paise, COALESCE(bp.gst_percent, 0)
      INTO v_expected_total_paise, v_expected_tax_paise, v_expected_sub_paise, v_gst_pct
    FROM public.billing_price_versions pv
    JOIN public.billing_products bp ON bp.id = pv.product_id
    WHERE pv.product_id = NEW.product_id
      AND pv.is_active = true
    ORDER BY pv.effective_at DESC NULLS LAST
    LIMIT 1;

    IF v_expected_total_paise IS NULL THEN
      RAISE EXCEPTION 'No active price version for product %', NEW.product_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.amount_total_paise IS DISTINCT FROM v_expected_total_paise THEN
      RAISE EXCEPTION 'amount_total_paise (%) does not match authoritative price (%)',
        NEW.amount_total_paise, v_expected_total_paise
        USING ERRCODE = 'check_violation';
    END IF;

    -- If caller supplied tax/subtotal, they must also match; otherwise fill them in.
    IF NEW.amount_tax_paise IS NULL THEN
      NEW.amount_tax_paise := v_expected_tax_paise;
    ELSIF NEW.amount_tax_paise IS DISTINCT FROM v_expected_tax_paise THEN
      RAISE EXCEPTION 'amount_tax_paise mismatch (expected %)', v_expected_tax_paise
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.amount_subtotal_paise IS NULL THEN
      NEW.amount_subtotal_paise := v_expected_sub_paise;
    ELSIF NEW.amount_subtotal_paise IS DISTINCT FROM v_expected_sub_paise THEN
      RAISE EXCEPTION 'amount_subtotal_paise mismatch (expected %)', v_expected_sub_paise
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- No product_id: block any positive amount from customers to avoid arbitrary
    -- price-labeled orders sneaking through. Zero-amount orders (e.g. free plan
    -- provisioning drafts) remain allowed.
    IF COALESCE(NEW.amount_total_paise, 0) > 0 THEN
      RAISE EXCEPTION 'Orders without product_id must have amount_total_paise = 0'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_billing_orders_insert_amounts ON public.billing_orders;
CREATE TRIGGER trg_enforce_billing_orders_insert_amounts
  BEFORE INSERT ON public.billing_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_billing_orders_insert_amounts();
