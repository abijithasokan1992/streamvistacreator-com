DROP VIEW IF EXISTS public.admin_studio_vault_purchases;

CREATE OR REPLACE FUNCTION public.admin_studio_vault_purchases(_limit int DEFAULT 100)
 RETURNS TABLE(
   topup_id uuid,
   user_id uuid,
   customer_email text,
   product_name text,
   storage_class text,
   tb_added numeric,
   billing_interval_months int,
   amount_inr numeric,
   total_paise bigint,
   status text,
   entitlement_projected_at timestamptz,
   razorpay_order_id text,
   razorpay_payment_id text,
   invoice_id uuid,
   invoice_number text,
   created_at timestamptz,
   updated_at timestamptz
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT
      t.id, t.user_id, u.email,
      vp.name, vp.storage_class,
      t.tb_added, t.billing_interval_months, t.amount_inr, t.total_paise,
      t.status, t.entitlement_projected_at,
      t.razorpay_order_id, t.razorpay_payment_id,
      i.id, i.invoice_number,
      t.created_at, t.updated_at
    FROM public.storage_topups t
    LEFT JOIN public.studio_vault_products vp ON vp.id = t.vault_product_id
    LEFT JOIN auth.users u ON u.id = t.user_id
    LEFT JOIN public.invoices i ON i.topup_id = t.id
    WHERE t.source = 'studio_vault'
    ORDER BY t.created_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 500));
END $function$;

REVOKE ALL ON FUNCTION public.admin_studio_vault_purchases(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_studio_vault_purchases(int) TO authenticated, service_role;
