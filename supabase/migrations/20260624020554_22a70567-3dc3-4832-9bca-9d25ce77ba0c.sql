
-- 1) New columns on manual_invoices for entitlement payload + grant trace
ALTER TABLE public.manual_invoices
  ADD COLUMN IF NOT EXISTS grants_plan_code text,
  ADD COLUMN IF NOT EXISTS grants_until date,
  ADD COLUMN IF NOT EXISTS entitlement_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS entitlement_assignment_id uuid REFERENCES public.plan_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS manual_invoices_grants_idx
  ON public.manual_invoices(grants_plan_code) WHERE grants_plan_code IS NOT NULL;

-- 2) Drop + recreate create/update RPCs with new optional grant params
DROP FUNCTION IF EXISTS public.admin_create_manual_invoice(
  uuid, uuid, text, text, jsonb, numeric, boolean, date, text, text, text
);

CREATE OR REPLACE FUNCTION public.admin_create_manual_invoice(
  _user_id uuid,
  _support_request_id uuid,
  _document_type text,
  _surface text,
  _line_items jsonb,
  _gst_percent numeric DEFAULT 18,
  _tax_inclusive boolean DEFAULT false,
  _due_date date DEFAULT NULL::date,
  _notes text DEFAULT NULL::text,
  _payment_method text DEFAULT NULL::text,
  _payment_link_url text DEFAULT NULL::text,
  _grants_plan_code text DEFAULT NULL::text,
  _grants_until date DEFAULT NULL::date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_id uuid;
  v_t record;
  v_email text;
  v_name text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _grants_plan_code IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = _grants_plan_code AND is_active) THEN
      RAISE EXCEPTION 'unknown_or_inactive_plan_%', _grants_plan_code;
    END IF;
  END IF;

  SELECT * INTO v_t FROM public._mi_compute_totals(_line_items, _gst_percent, _tax_inclusive);
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  SELECT COALESCE(full_name, display_name) INTO v_name FROM public.user_profiles WHERE user_id = _user_id;

  INSERT INTO public.manual_invoices (
    user_id, surface, support_request_id, document_type, line_items,
    gst_percent, tax_inclusive, subtotal_paise, gst_paise, total_paise,
    due_date, notes, payment_method, payment_link_url,
    billed_to_email, billed_to_name, created_by,
    grants_plan_code, grants_until
  ) VALUES (
    _user_id, COALESCE(_surface,'creator'), _support_request_id,
    COALESCE(_document_type,'invoice'), COALESCE(_line_items,'[]'::jsonb),
    COALESCE(_gst_percent,18), COALESCE(_tax_inclusive,false),
    v_t.subtotal_paise, v_t.gst_paise, v_t.total_paise,
    _due_date, _notes, _payment_method, _payment_link_url,
    v_email, v_name, v_caller,
    _grants_plan_code, _grants_until
  ) RETURNING id INTO v_id;

  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller, 'invoice_drafted', _user_id, _support_request_id, v_id,
          jsonb_build_object(
            'total_paise', v_t.total_paise,
            'doc', COALESCE(_document_type,'invoice'),
            'grants_plan_code', _grants_plan_code,
            'grants_until', _grants_until
          ));

  IF _support_request_id IS NOT NULL THEN
    UPDATE public.support_requests SET status = 'quoted'
     WHERE id = _support_request_id AND status IN ('open','in_progress','reviewing');
  END IF;

  RETURN v_id;
END $function$;

DROP FUNCTION IF EXISTS public.admin_update_manual_invoice(
  uuid, jsonb, numeric, boolean, date, text, text, text
);

CREATE OR REPLACE FUNCTION public.admin_update_manual_invoice(
  _invoice_id uuid,
  _line_items jsonb,
  _gst_percent numeric DEFAULT NULL::numeric,
  _tax_inclusive boolean DEFAULT NULL::boolean,
  _due_date date DEFAULT NULL::date,
  _notes text DEFAULT NULL::text,
  _payment_method text DEFAULT NULL::text,
  _payment_link_url text DEFAULT NULL::text,
  _grants_plan_code text DEFAULT NULL::text,
  _grants_until date DEFAULT NULL::date,
  _clear_grant boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_cur record;
  v_pct numeric;
  v_inc boolean;
  v_t record;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO v_cur FROM public.manual_invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_cur.status NOT IN ('draft') THEN RAISE EXCEPTION 'not_editable_in_status_%', v_cur.status; END IF;

  IF _grants_plan_code IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plans WHERE code = _grants_plan_code AND is_active) THEN
      RAISE EXCEPTION 'unknown_or_inactive_plan_%', _grants_plan_code;
    END IF;
  END IF;

  v_pct := COALESCE(_gst_percent, v_cur.gst_percent);
  v_inc := COALESCE(_tax_inclusive, v_cur.tax_inclusive);
  SELECT * INTO v_t FROM public._mi_compute_totals(COALESCE(_line_items, v_cur.line_items), v_pct, v_inc);

  UPDATE public.manual_invoices SET
    line_items = COALESCE(_line_items, line_items),
    gst_percent = v_pct, tax_inclusive = v_inc,
    subtotal_paise = v_t.subtotal_paise, gst_paise = v_t.gst_paise, total_paise = v_t.total_paise,
    due_date = COALESCE(_due_date, due_date),
    notes = COALESCE(_notes, notes),
    payment_method = COALESCE(_payment_method, payment_method),
    payment_link_url = COALESCE(_payment_link_url, payment_link_url),
    grants_plan_code = CASE WHEN _clear_grant THEN NULL ELSE COALESCE(_grants_plan_code, grants_plan_code) END,
    grants_until = CASE WHEN _clear_grant THEN NULL ELSE COALESCE(_grants_until, grants_until) END
  WHERE id = _invoice_id;
END $function$;

-- 3) New RPC: grant entitlement from a paid manual invoice
CREATE OR REPLACE FUNCTION public.admin_grant_invoice_entitlement(_invoice_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_inv record;
  v_plan record;
  v_assignment_id uuid;
  v_ends_at timestamptz;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_inv FROM public.manual_invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_inv.status <> 'paid' THEN RAISE EXCEPTION 'invoice_not_paid'; END IF;
  IF v_inv.grants_plan_code IS NULL THEN RAISE EXCEPTION 'no_grant_configured'; END IF;
  IF v_inv.entitlement_granted_at IS NOT NULL THEN
    RETURN v_inv.entitlement_assignment_id;
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE code = v_inv.grants_plan_code AND is_active;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'unknown_or_inactive_plan_%', v_inv.grants_plan_code; END IF;

  v_ends_at := CASE
    WHEN v_inv.grants_until IS NOT NULL THEN (v_inv.grants_until::timestamptz + interval '1 day' - interval '1 second')
    ELSE NULL
  END;

  INSERT INTO public.plan_assignments (
    user_id, plan_id, status, granted_by, starts_at, ends_at, is_lifetime, notes
  ) VALUES (
    v_inv.user_id, v_plan.id, 'active'::plan_assignment_status, v_caller,
    now(), v_ends_at, (v_ends_at IS NULL),
    'Granted via manual invoice ' || v_inv.invoice_number
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.workspace_storage_entitlements AS w (
    user_id, plan_code, included_storage_gb,
    source, grant_reason, granted_by,
    effective_from, effective_to
  ) VALUES (
    v_inv.user_id, v_plan.code, COALESCE(v_plan.storage_gb, 0),
    'paid_subscription', 'manual_invoice:' || v_inv.invoice_number, v_caller,
    now(), v_ends_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    included_storage_gb = GREATEST(w.included_storage_gb, EXCLUDED.included_storage_gb),
    source = EXCLUDED.source,
    grant_reason = EXCLUDED.grant_reason,
    granted_by = EXCLUDED.granted_by,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    billing_status = 'ok',
    updated_at = now();

  UPDATE public.manual_invoices
     SET entitlement_granted_at = now(),
         entitlement_assignment_id = v_assignment_id
   WHERE id = _invoice_id;

  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller, 'entitlement_granted', v_inv.user_id, v_inv.support_request_id, v_inv.id,
          jsonb_build_object(
            'plan_code', v_plan.code,
            'plan_id', v_plan.id,
            'assignment_id', v_assignment_id,
            'ends_at', v_ends_at,
            'storage_gb', v_plan.storage_gb
          ));

  RETURN v_assignment_id;
END $function$;

-- 4) Auto-grant on payment when configured
CREATE OR REPLACE FUNCTION public.admin_mark_invoice_paid(
  _invoice_id uuid, _payment_method text DEFAULT NULL::text, _payment_reference text DEFAULT NULL::text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller uuid := auth.uid(); v_cur record;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_cur FROM public.manual_invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_cur.status NOT IN ('issued','overdue','draft') THEN RAISE EXCEPTION 'cannot_mark_paid_from_%', v_cur.status; END IF;
  UPDATE public.manual_invoices SET
    status='paid', paid_at=now(),
    payment_method = COALESCE(_payment_method, payment_method),
    payment_reference = COALESCE(_payment_reference, payment_reference),
    issued_at = COALESCE(issued_at, now())
  WHERE id = _invoice_id;
  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller,'invoice_paid', v_cur.user_id, v_cur.support_request_id, _invoice_id,
          jsonb_build_object('method', COALESCE(_payment_method, v_cur.payment_method), 'ref', _payment_reference));
  IF v_cur.support_request_id IS NOT NULL THEN
    UPDATE public.support_requests SET status='approved' WHERE id=v_cur.support_request_id AND status IN ('quoted','issued','open','in_progress','reviewing');
  END IF;
  -- Auto-grant entitlement when invoice carries a grant config and not yet granted.
  IF v_cur.grants_plan_code IS NOT NULL AND v_cur.entitlement_granted_at IS NULL THEN
    PERFORM public.admin_grant_invoice_entitlement(_invoice_id);
  END IF;
END $function$;
