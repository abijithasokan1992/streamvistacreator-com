
-- ============================================================
-- 11.3B Payments OS operational layer
-- ============================================================

-- Allow authenticated customers to read enabled payment method configs
-- (so they can see bank/UPI instructions). Admin write policy stays as-is.
DROP POLICY IF EXISTS "billing_pmc_customer_read_enabled" ON public.billing_payment_method_configs;
CREATE POLICY "billing_pmc_customer_read_enabled"
  ON public.billing_payment_method_configs
  FOR SELECT
  TO authenticated
  USING (is_enabled = true);

-- ------------------------------------------------------------
-- Canonical fulfillment orchestrator
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_billing_order(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  o public.billing_orders%ROWTYPE;
  v_already boolean;
  v_proj jsonb;
  v_topup public.storage_topups%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.billing_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN
    RAISE EXCEPTION 'billing_order % not found', _order_id USING ERRCODE='P0002';
  END IF;

  IF o.status <> 'paid' THEN
    RAISE EXCEPTION 'billing_order % not in paid state (status=%)', _order_id, o.status USING ERRCODE='22023';
  END IF;

  -- Idempotency guard via ledger
  SELECT EXISTS(SELECT 1 FROM public.billing_ledger_events
                 WHERE billing_order_id = _order_id
                   AND event_type = 'order.fulfilled') INTO v_already;
  IF v_already THEN
    RETURN jsonb_build_object('ok', true, 'already_fulfilled', true, 'order_id', _order_id);
  END IF;

  -- Dispatch by source_type
  IF o.source_type IN ('studio_vault','creator_payg') AND o.source_ref_id IS NOT NULL THEN
    SELECT * INTO v_topup FROM public.storage_topups WHERE id = o.source_ref_id;
    IF v_topup.id IS NULL THEN
      RAISE EXCEPTION 'storage_topup % missing for billing_order %', o.source_ref_id, _order_id;
    END IF;
    -- Ensure topup is marked paid so project_topup_entitlement will run
    IF v_topup.status <> 'paid' THEN
      UPDATE public.storage_topups SET status = 'paid', updated_at = now() WHERE id = v_topup.id;
    END IF;
    v_proj := public.project_topup_entitlement(o.source_ref_id);
    -- Link invoice back into billing_orders if not yet set
    IF o.invoice_id IS NULL AND (v_proj->>'invoice_id') IS NOT NULL THEN
      UPDATE public.billing_orders
         SET invoice_id = (v_proj->>'invoice_id')::uuid, updated_at = now()
       WHERE id = _order_id;
    END IF;
    INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
    VALUES (_order_id, 'order.fulfilled', auth.uid(),
            jsonb_build_object('handler','studio_vault_or_creator_payg','projection', v_proj));
    RETURN jsonb_build_object('ok', true, 'handler','studio_vault_or_creator_payg', 'projection', v_proj);
  END IF;

  -- Placeholder handlers for future product types
  INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
  VALUES (_order_id, 'order.fulfillment_deferred', auth.uid(),
          jsonb_build_object('reason','no_handler_for_source_type','source_type', o.source_type));
  RETURN jsonb_build_object('ok', true, 'handler','deferred', 'source_type', o.source_type);
END$$;

REVOKE ALL ON FUNCTION public.fulfill_billing_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_billing_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_billing_order(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Customer: create a Studio Vault order in MANUAL rail
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_manual_vault_order(
  _vault_product_id uuid,
  _billing_interval_months int,
  _payment_mode text,            -- 'bank_transfer' | 'upi_manual' | 'invoice_offline'
  _customer_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  vp public.studio_vault_products%ROWTYPE;
  v_topup_id uuid;
  v_order_id uuid;
  v_subtotal bigint;
  v_gst bigint;
  v_total bigint;
  v_tb numeric;
  v_rail public.billing_payment_rail;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'; END IF;
  IF _payment_mode NOT IN ('bank_transfer','upi_manual','invoice_offline') THEN
    RAISE EXCEPTION 'invalid payment_mode' USING ERRCODE='22023';
  END IF;
  v_rail := _payment_mode::public.billing_payment_rail;

  SELECT * INTO vp FROM public.studio_vault_products WHERE id = _vault_product_id AND active = true;
  IF vp.id IS NULL THEN RAISE EXCEPTION 'vault product not found or inactive' USING ERRCODE='P0002'; END IF;

  IF _billing_interval_months IS NULL OR _billing_interval_months < 1 THEN
    _billing_interval_months := COALESCE(vp.default_billing_interval_months, 1);
  END IF;

  v_tb := COALESCE(vp.tb_per_unit, 1);
  -- Server-authoritative pricing
  v_subtotal := (COALESCE(vp.unit_price_paise, 0))::bigint * GREATEST(1, _billing_interval_months);
  v_gst      := round(v_subtotal * COALESCE(vp.gst_percent, 18) / 100.0)::bigint;
  v_total    := v_subtotal + v_gst;

  INSERT INTO public.storage_topups(
    user_id, source, vault_product_id,
    tb_added, billing_interval_months,
    amount_inr, subtotal_paise, gst_paise, total_paise,
    status
  ) VALUES (
    uid, 'studio_vault', vp.id,
    v_tb, _billing_interval_months,
    (v_total/100.0)::numeric, v_subtotal, v_gst, v_total,
    'pending'
  ) RETURNING id INTO v_topup_id;

  -- The billing_sync trigger creates / upserts the billing_orders row.
  -- Update it to reflect MANUAL rail (default trigger sets razorpay).
  SELECT id INTO v_order_id FROM public.billing_orders
    WHERE source_type='studio_vault' AND source_ref_id=v_topup_id;

  UPDATE public.billing_orders
     SET payment_method_mode = v_rail,
         status = 'awaiting_payment',
         notes = COALESCE(_customer_note, notes),
         metadata = metadata || jsonb_build_object('manual_intent', _payment_mode),
         updated_at = now()
   WHERE id = v_order_id;

  INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
  VALUES (v_order_id, 'order.manual_created', uid,
          jsonb_build_object('rail', _payment_mode, 'vault_product_id', vp.id));

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'topup_id', v_topup_id,
    'amount_total_paise', v_total
  );
END$$;

GRANT EXECUTE ON FUNCTION public.create_manual_vault_order(uuid,int,text,text) TO authenticated;

-- ------------------------------------------------------------
-- Customer: submit manual payment proof
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  _order_id uuid,
  _payment_channel text,        -- 'bank_transfer'|'upi_manual'|'cheque'|'invoice_offline'
  _amount_paid_paise bigint,
  _paid_at timestamptz,
  _utr_or_reference text,
  _bank_name text DEFAULT NULL,
  _payer_name text DEFAULT NULL,
  _payer_phone text DEFAULT NULL,
  _payer_email text DEFAULT NULL,
  _remarks text DEFAULT NULL,
  _proof_file_path text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  o public.billing_orders%ROWTYPE;
  v_sub_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required' USING ERRCODE='42501'; END IF;

  SELECT * INTO o FROM public.billing_orders WHERE id = _order_id;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE='P0002'; END IF;
  IF o.customer_user_id <> uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF o.status NOT IN ('awaiting_payment','payment_under_review') THEN
    RAISE EXCEPTION 'order is not accepting proof in status %', o.status USING ERRCODE='22023';
  END IF;
  IF COALESCE(_amount_paid_paise,0) <= 0 THEN
    RAISE EXCEPTION 'amount_paid_paise required' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.billing_manual_payment_submissions(
    billing_order_id, submitted_by_user_id,
    payer_name, payer_phone, payer_email,
    payment_channel, amount_paid_paise, paid_at,
    utr_or_reference, bank_name, remarks,
    proof_file_path, status
  ) VALUES (
    _order_id, uid,
    _payer_name, _payer_phone, _payer_email,
    _payment_channel, _amount_paid_paise, _paid_at,
    _utr_or_reference, _bank_name, _remarks,
    _proof_file_path, 'submitted'
  ) RETURNING id INTO v_sub_id;

  UPDATE public.billing_orders
     SET status = 'payment_under_review', updated_at = now()
   WHERE id = _order_id;

  INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
  VALUES (_order_id, 'order.proof_submitted', uid,
          jsonb_build_object('submission_id', v_sub_id, 'channel', _payment_channel,
                             'amount_paid_paise', _amount_paid_paise, 'utr', _utr_or_reference));

  RETURN jsonb_build_object('ok', true, 'submission_id', v_sub_id);
END$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_payment_proof(uuid,text,bigint,timestamptz,text,text,text,text,text,text,text) TO authenticated;

-- ------------------------------------------------------------
-- Admin: review manual payment (approve / reject / clarify)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_review_manual_payment(
  _submission_id uuid,
  _action text,                 -- 'approve' | 'reject' | 'request_clarification'
  _review_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  sub public.billing_manual_payment_submissions%ROWTYPE;
  o public.billing_orders%ROWTYPE;
  v_attempt_id uuid;
  v_fulfill jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  IF _action NOT IN ('approve','reject','request_clarification') THEN
    RAISE EXCEPTION 'invalid action' USING ERRCODE='22023';
  END IF;

  SELECT * INTO sub FROM public.billing_manual_payment_submissions WHERE id = _submission_id FOR UPDATE;
  IF sub.id IS NULL THEN RAISE EXCEPTION 'submission not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO o FROM public.billing_orders WHERE id = sub.billing_order_id FOR UPDATE;

  IF _action = 'approve' THEN
    IF sub.status = 'approved' THEN
      RETURN jsonb_build_object('ok', true, 'already', 'approved');
    END IF;
    UPDATE public.billing_manual_payment_submissions
       SET status='approved', reviewed_by=uid, reviewed_at=now(),
           review_notes=COALESCE(_review_notes, review_notes), updated_at=now()
     WHERE id = _submission_id;

    INSERT INTO public.billing_payment_attempts(
      billing_order_id, rail, status, amount_paise, currency, utr_or_reference, verified_by, verified_at
    ) VALUES (
      o.id, o.payment_method_mode, 'verified',
      sub.amount_paid_paise, sub.currency, sub.utr_or_reference, uid, now()
    ) RETURNING id INTO v_attempt_id;

    UPDATE public.billing_orders
       SET status='paid', updated_at=now()
     WHERE id = o.id;

    INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
    VALUES (o.id, 'manual.approved', uid,
            jsonb_build_object('submission_id', sub.id, 'attempt_id', v_attempt_id, 'notes', _review_notes));

    v_fulfill := public.fulfill_billing_order(o.id);
    RETURN jsonb_build_object('ok', true, 'action','approve','attempt_id', v_attempt_id, 'fulfillment', v_fulfill);

  ELSIF _action = 'reject' THEN
    UPDATE public.billing_manual_payment_submissions
       SET status='rejected', reviewed_by=uid, reviewed_at=now(),
           review_notes=COALESCE(_review_notes, review_notes), updated_at=now()
     WHERE id = _submission_id;
    -- Keep order open so customer can resubmit; only mark failed when nothing else outstanding
    UPDATE public.billing_orders
       SET status = CASE WHEN status = 'payment_under_review' THEN 'awaiting_payment'::public.billing_order_status ELSE status END,
           updated_at = now()
     WHERE id = o.id;
    INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
    VALUES (o.id, 'manual.rejected', uid, jsonb_build_object('submission_id', sub.id, 'notes', _review_notes));
    RETURN jsonb_build_object('ok', true, 'action','reject');

  ELSE -- request_clarification
    UPDATE public.billing_manual_payment_submissions
       SET status='needs_clarification', reviewed_by=uid, reviewed_at=now(),
           review_notes=COALESCE(_review_notes, review_notes), updated_at=now()
     WHERE id = _submission_id;
    INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
    VALUES (o.id, 'manual.clarification_requested', uid, jsonb_build_object('submission_id', sub.id, 'notes', _review_notes));
    RETURN jsonb_build_object('ok', true, 'action','request_clarification');
  END IF;
END$$;

GRANT EXECUTE ON FUNCTION public.admin_review_manual_payment(uuid,text,text) TO authenticated;

-- ------------------------------------------------------------
-- Restricted super-admin override: force order to paid + fulfill
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_mark_order_paid(
  _order_id uuid,
  _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  o public.billing_orders%ROWTYPE;
  v_attempt_id uuid;
  v_fulfill jsonb;
BEGIN
  IF uid IS NULL OR NOT public.is_super_admin(uid) THEN
    RAISE EXCEPTION 'super admin only' USING ERRCODE='42501';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 8 THEN
    RAISE EXCEPTION 'reason required (min 8 chars)' USING ERRCODE='22023';
  END IF;

  SELECT * INTO o FROM public.billing_orders WHERE id = _order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order not found' USING ERRCODE='P0002'; END IF;

  INSERT INTO public.billing_payment_attempts(
    billing_order_id, rail, status, amount_paise, currency, verified_by, verified_at, failure_reason
  ) VALUES (
    o.id, 'admin_mark_paid', 'verified', o.amount_total_paise, o.currency, uid, now(), NULL
  ) RETURNING id INTO v_attempt_id;

  UPDATE public.billing_orders
     SET status='paid', payment_method_mode='admin_mark_paid', updated_at=now()
   WHERE id = o.id;

  INSERT INTO public.billing_ledger_events(billing_order_id, event_type, actor_user_id, payload)
  VALUES (o.id, 'admin.mark_paid', uid, jsonb_build_object('reason', _reason, 'attempt_id', v_attempt_id));

  INSERT INTO public.admin_audit_log(admin_user_id, admin_email, action, details)
  VALUES (uid, (SELECT email FROM auth.users WHERE id = uid),
          'billing.admin_mark_paid',
          jsonb_build_object('order_id', o.id, 'reason', _reason, 'amount_total_paise', o.amount_total_paise));

  v_fulfill := public.fulfill_billing_order(o.id);
  RETURN jsonb_build_object('ok', true, 'attempt_id', v_attempt_id, 'fulfillment', v_fulfill);
END$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid,text) TO authenticated;

-- ------------------------------------------------------------
-- Admin read views
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_billing_orders_list(
  _app_key text DEFAULT NULL,
  _status text DEFAULT NULL,
  _rail text DEFAULT NULL,
  _limit int DEFAULT 100
) RETURNS TABLE(
  id uuid, app_key text, source_type text,
  customer_user_id uuid, customer_email text,
  amount_total_paise bigint, currency text,
  status text, payment_method_mode text,
  invoice_id uuid, invoice_number text,
  payment_trace_id uuid, razorpay_order_id text,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT o.id, o.app_key, o.source_type,
           o.customer_user_id, u.email,
           o.amount_total_paise, o.currency,
           o.status::text, o.payment_method_mode::text,
           o.invoice_id, i.invoice_number,
           o.payment_trace_id, pt.order_id,
           o.created_at, o.updated_at
      FROM public.billing_orders o
      LEFT JOIN auth.users u ON u.id = o.customer_user_id
      LEFT JOIN public.invoices i ON i.id = o.invoice_id
      LEFT JOIN public.payment_traces pt ON pt.id = o.payment_trace_id
     WHERE (_app_key IS NULL OR o.app_key = _app_key)
       AND (_status  IS NULL OR o.status::text = _status)
       AND (_rail    IS NULL OR o.payment_method_mode::text = _rail)
     ORDER BY o.created_at DESC
     LIMIT GREATEST(1, LEAST(_limit, 500));
END$$;

GRANT EXECUTE ON FUNCTION public.admin_billing_orders_list(text,text,text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_pending_manual_reviews(_limit int DEFAULT 100)
RETURNS TABLE(
  submission_id uuid, order_id uuid, app_key text, source_type text,
  customer_user_id uuid, customer_email text,
  payment_channel text, amount_paid_paise bigint, currency text,
  utr_or_reference text, bank_name text, paid_at timestamptz,
  proof_file_path text, remarks text, payer_name text, payer_phone text, payer_email text,
  submission_status text, order_status text,
  submitted_at timestamptz, order_total_paise bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT s.id, o.id, o.app_key, o.source_type,
           o.customer_user_id, u.email,
           s.payment_channel, s.amount_paid_paise, s.currency,
           s.utr_or_reference, s.bank_name, s.paid_at,
           s.proof_file_path, s.remarks, s.payer_name, s.payer_phone, s.payer_email,
           s.status::text, o.status::text,
           s.created_at, o.amount_total_paise
      FROM public.billing_manual_payment_submissions s
      JOIN public.billing_orders o ON o.id = s.billing_order_id
      LEFT JOIN auth.users u ON u.id = o.customer_user_id
     WHERE s.status IN ('submitted','under_review','needs_clarification')
     ORDER BY s.created_at ASC
     LIMIT GREATEST(1, LEAST(_limit, 500));
END$$;

GRANT EXECUTE ON FUNCTION public.admin_pending_manual_reviews(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_billing_order_detail(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); v_out jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object(
    'order', to_jsonb(o.*) || jsonb_build_object('customer_email', u.email),
    'invoice', to_jsonb(i.*),
    'payment_trace', to_jsonb(pt.*),
    'attempts', COALESCE((SELECT jsonb_agg(to_jsonb(a.*) ORDER BY a.created_at) FROM public.billing_payment_attempts a WHERE a.billing_order_id=o.id), '[]'::jsonb),
    'manual_submissions', COALESCE((SELECT jsonb_agg(to_jsonb(s.*) ORDER BY s.created_at) FROM public.billing_manual_payment_submissions s WHERE s.billing_order_id=o.id), '[]'::jsonb),
    'ledger', COALESCE((SELECT jsonb_agg(to_jsonb(le.*) ORDER BY le.created_at) FROM public.billing_ledger_events le WHERE le.billing_order_id=o.id), '[]'::jsonb)
  ) INTO v_out
  FROM public.billing_orders o
  LEFT JOIN auth.users u ON u.id = o.customer_user_id
  LEFT JOIN public.invoices i ON i.id = o.invoice_id
  LEFT JOIN public.payment_traces pt ON pt.id = o.payment_trace_id
  WHERE o.id = _order_id;
  RETURN v_out;
END$$;

GRANT EXECUTE ON FUNCTION public.admin_billing_order_detail(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Reconciliation: after billing_sync, if order became 'paid', auto-fulfill
-- (covers Razorpay verify/webhook path where storage_topups flips to paid)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_billing_orders_autofulfill()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status <> 'paid') THEN
    BEGIN
      PERFORM public.fulfill_billing_order(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.billing_ledger_events(billing_order_id, event_type, payload)
      VALUES (NEW.id, 'order.fulfillment_error', jsonb_build_object('error', SQLERRM));
    END;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_billing_orders_autofulfill ON public.billing_orders;
CREATE TRIGGER trg_billing_orders_autofulfill
AFTER INSERT OR UPDATE OF status ON public.billing_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_billing_orders_autofulfill();
