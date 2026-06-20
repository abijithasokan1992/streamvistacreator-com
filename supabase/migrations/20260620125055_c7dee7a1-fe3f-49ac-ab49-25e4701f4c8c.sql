ALTER TABLE public.storage_topups
  ADD COLUMN IF NOT EXISTS entitlement_projected_at timestamptz;

-- Backfill: any existing paid row is considered already projected.
UPDATE public.storage_topups
   SET entitlement_projected_at = COALESCE(entitlement_projected_at, updated_at, created_at, now())
 WHERE status = 'paid' AND entitlement_projected_at IS NULL;

CREATE OR REPLACE FUNCTION public.project_topup_entitlement(_topup_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t          public.storage_topups%ROWTYPE;
  vp         public.studio_vault_products%ROWTYPE;
  creator_plan_id uuid;
  alloc_id   uuid;
  inv_row    public.invoices%ROWTYPE;
  user_email text;
  tb_int     int;
  gb_to_add  int;
  subtotal   bigint;
  gst        bigint;
  total      bigint;
  src        text;
  already_projected boolean;
BEGIN
  SELECT * INTO t FROM public.storage_topups WHERE id = _topup_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'topup % not found', _topup_id USING ERRCODE='P0002';
  END IF;
  IF t.status <> 'paid' THEN
    RAISE EXCEPTION 'topup % is not paid (status=%)', _topup_id, t.status USING ERRCODE='22023';
  END IF;

  already_projected := t.entitlement_projected_at IS NOT NULL;

  src := COALESCE(t.source,'creator_payg');
  tb_int := GREATEST(1, COALESCE(t.tb_added,1)::int);
  gb_to_add := tb_int * 1024;
  SELECT email INTO user_email FROM auth.users WHERE id = t.user_id;

  IF src = 'studio_vault' AND t.vault_product_id IS NOT NULL THEN
    SELECT * INTO vp FROM public.studio_vault_products WHERE id = t.vault_product_id;

    -- Allocation: only mutate if not yet projected (idempotency guard)
    IF NOT already_projected THEN
      SELECT id INTO alloc_id
        FROM public.storage_allocations
       WHERE user_id = t.user_id AND source = 'studio_vault_'||vp.storage_class
       ORDER BY created_at ASC LIMIT 1;

      IF alloc_id IS NULL THEN
        INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, notes)
        VALUES (t.user_id, gb_to_add, 0, 'studio_vault_'||vp.storage_class,
                'Studio Vault '||vp.name||' — topup '||t.id);
      ELSE
        UPDATE public.storage_allocations
           SET allocated_gb = allocated_gb + gb_to_add, updated_at = now()
         WHERE id = alloc_id;
      END IF;
    END IF;

    SELECT * INTO inv_row FROM public.invoices WHERE topup_id = t.id LIMIT 1;
    IF inv_row.id IS NULL THEN
      subtotal := COALESCE(t.subtotal_paise, 0);
      gst      := COALESCE(t.gst_paise, 0);
      total    := COALESCE(t.total_paise, subtotal + gst);
      INSERT INTO public.invoices (
        user_id, plan_id, topup_id, source, description,
        subtotal_paise, gst_percent, gst_paise, total_paise,
        razorpay_order_id, razorpay_payment_id, billed_to_email
      ) VALUES (
        t.user_id, NULL, t.id, 'studio_vault',
        'Studio Vault — '||vp.name||' ('||vp.storage_class||') — '||tb_int||' TB × '||COALESCE(t.billing_interval_months,1)||' month(s)',
        subtotal, COALESCE(vp.gst_percent,18), gst, total,
        t.razorpay_order_id, t.razorpay_payment_id, user_email
      ) RETURNING * INTO inv_row;
    END IF;

    IF NOT already_projected THEN
      UPDATE public.storage_topups SET entitlement_projected_at = now(), updated_at = now() WHERE id = t.id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true, 'source','studio_vault', 'already_projected', already_projected,
      'vault_product_id', vp.id, 'storage_class', vp.storage_class,
      'tb_added', tb_int, 'invoice_id', inv_row.id, 'invoice_number', inv_row.invoice_number
    );
  END IF;

  -- Creator pay-as-you-go branch
  SELECT id INTO creator_plan_id FROM public.plans WHERE code='creator_payg_1tb' LIMIT 1;
  IF creator_plan_id IS NULL THEN
    RAISE EXCEPTION 'creator_payg_1tb plan not seeded' USING ERRCODE='P0002';
  END IF;

  IF NOT already_projected THEN
    INSERT INTO public.plan_assignments (user_id, plan_id, status, starts_at, notes)
    VALUES (t.user_id, creator_plan_id, 'active', now(), 'auto: topup '||t.id)
    ON CONFLICT DO NOTHING;

    SELECT id INTO alloc_id
      FROM public.storage_allocations
     WHERE user_id = t.user_id AND source = 'creator_payg'
     ORDER BY created_at ASC LIMIT 1;

    IF alloc_id IS NULL THEN
      INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, notes)
      VALUES (t.user_id, gb_to_add, 0, 'creator_payg', 'auto: first topup '||t.id);
    ELSE
      UPDATE public.storage_allocations
         SET allocated_gb = allocated_gb + gb_to_add, updated_at = now()
       WHERE id = alloc_id;
    END IF;

    UPDATE public.user_profiles
       SET plan_tier = 'creator',
           topup_tb  = GREATEST(COALESCE(topup_tb,0), tb_int),
           updated_at = now()
     WHERE user_id = t.user_id;
  END IF;

  SELECT * INTO inv_row FROM public.invoices WHERE topup_id = t.id LIMIT 1;
  IF inv_row.id IS NULL THEN
    subtotal := 65000::bigint * tb_int;
    gst      := round(subtotal * 0.18)::bigint;
    total    := subtotal + gst;
    INSERT INTO public.invoices (
      user_id, plan_id, topup_id, source, description,
      subtotal_paise, gst_percent, gst_paise, total_paise,
      razorpay_order_id, razorpay_payment_id, billed_to_email
    ) VALUES (
      t.user_id, creator_plan_id, t.id, 'topup',
      'Creator Plan — '||tb_int||' TB storage (Pay-As-You-Go)',
      subtotal, 18, gst, total,
      t.razorpay_order_id, t.razorpay_payment_id, user_email
    ) RETURNING * INTO inv_row;
  END IF;

  IF NOT already_projected THEN
    UPDATE public.storage_topups SET entitlement_projected_at = now(), updated_at = now() WHERE id = t.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'source','creator_payg', 'already_projected', already_projected,
    'plan_id', creator_plan_id, 'tb_added', tb_int,
    'invoice_id', inv_row.id, 'invoice_number', inv_row.invoice_number
  );
END$function$;

-- Minimal admin operational view for Stream 11.05 launch verification.
CREATE OR REPLACE VIEW public.admin_studio_vault_purchases AS
SELECT
  t.id              AS topup_id,
  t.user_id,
  u.email           AS customer_email,
  vp.name           AS product_name,
  vp.storage_class,
  t.tb_added,
  t.billing_interval_months,
  t.amount_inr,
  t.total_paise,
  t.status,
  t.entitlement_projected_at,
  t.razorpay_order_id,
  t.razorpay_payment_id,
  i.id              AS invoice_id,
  i.invoice_number,
  t.created_at,
  t.updated_at
FROM public.storage_topups t
LEFT JOIN public.studio_vault_products vp ON vp.id = t.vault_product_id
LEFT JOIN auth.users u ON u.id = t.user_id
LEFT JOIN public.invoices i ON i.topup_id = t.id
WHERE t.source = 'studio_vault'
ORDER BY t.created_at DESC;

GRANT SELECT ON public.admin_studio_vault_purchases TO authenticated;
GRANT ALL    ON public.admin_studio_vault_purchases TO service_role;

-- View inherits RLS from base tables; storage_topups already restricts non-admins to their own rows,
-- so non-admin queries against this view will only return that user's own vault purchases.
