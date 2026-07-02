
-- 1) Extend support_requests status check
ALTER TABLE public.support_requests DROP CONSTRAINT IF EXISTS support_requests_status_check;
ALTER TABLE public.support_requests ADD CONSTRAINT support_requests_status_check
  CHECK (status = ANY (ARRAY['open','in_progress','reviewing','quoted','approved','provisioned','rejected','cancelled','resolved','closed']));

-- 2) Extend plan_tier check
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_tier_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['free','creator','pro','studio','monthly','quarterly','yearly']));

-- 3) Manual invoices sequence + table
CREATE SEQUENCE IF NOT EXISTS public.manual_invoice_number_seq;

CREATE TABLE IF NOT EXISTS public.manual_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE
    DEFAULT ('SV-' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('public.manual_invoice_number_seq')::text, 5, '0')),
  document_type text NOT NULL DEFAULT 'invoice' CHECK (document_type IN ('quote','invoice')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','paid','void','overdue','cancelled')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  surface text NOT NULL DEFAULT 'creator' CHECK (surface IN ('creator','studio','buyer','internal')),
  support_request_id uuid REFERENCES public.support_requests(id) ON DELETE SET NULL,
  storage_allocation_id uuid REFERENCES public.storage_allocations(id) ON DELETE SET NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  currency text NOT NULL DEFAULT 'INR',
  subtotal_paise bigint NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
  gst_percent numeric NOT NULL DEFAULT 18,
  gst_paise bigint NOT NULL DEFAULT 0 CHECK (gst_paise >= 0),
  total_paise bigint NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
  tax_inclusive boolean NOT NULL DEFAULT false,
  due_date date,
  notes text,
  billed_to_name text,
  billed_to_email text,
  payment_method text CHECK (payment_method IN ('razorpay_link','manual_bank','offline','waived','other')),
  payment_reference text,
  payment_link_url text,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.manual_invoices TO authenticated;
GRANT ALL ON public.manual_invoices TO service_role;
GRANT USAGE ON SEQUENCE public.manual_invoice_number_seq TO authenticated, service_role;

ALTER TABLE public.manual_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manual_invoices admin all" ON public.manual_invoices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "manual_invoices owner read issued" ON public.manual_invoices
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND status IN ('issued','paid','overdue','void'));

CREATE INDEX IF NOT EXISTS manual_invoices_user_idx ON public.manual_invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_invoices_status_idx ON public.manual_invoices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_invoices_support_req_idx ON public.manual_invoices(support_request_id);

CREATE TRIGGER manual_invoices_touch BEFORE UPDATE ON public.manual_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Commercial audit log
CREATE TABLE IF NOT EXISTS public.commercial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  subject_user_id uuid,
  support_request_id uuid,
  manual_invoice_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commercial_audit_log TO authenticated;
GRANT ALL ON public.commercial_audit_log TO service_role;
ALTER TABLE public.commercial_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_audit admin read" ON public.commercial_audit_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()));
CREATE POLICY "commercial_audit admin insert" ON public.commercial_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS commercial_audit_subject_idx ON public.commercial_audit_log(subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_audit_request_idx ON public.commercial_audit_log(support_request_id);

-- Helper: compute totals from line items array
CREATE OR REPLACE FUNCTION public._mi_compute_totals(
  _line_items jsonb, _gst_percent numeric, _tax_inclusive boolean
) RETURNS TABLE(subtotal_paise bigint, gst_paise bigint, total_paise bigint)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_sub numeric := 0;
  v_item jsonb;
  v_qty numeric;
  v_unit numeric;
  v_total numeric;
  v_gst numeric;
BEGIN
  IF _line_items IS NULL THEN _line_items := '[]'::jsonb; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(_line_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::numeric, 1);
    v_unit := COALESCE((v_item->>'unit_paise')::numeric, 0);
    v_sub := v_sub + (v_qty * v_unit);
  END LOOP;
  IF _tax_inclusive THEN
    v_total := v_sub;
    v_sub := round(v_total / (1 + COALESCE(_gst_percent,0)/100.0));
    v_gst := v_total - v_sub;
  ELSE
    v_gst := round(v_sub * COALESCE(_gst_percent,0) / 100.0);
    v_total := v_sub + v_gst;
  END IF;
  subtotal_paise := v_sub::bigint;
  gst_paise := v_gst::bigint;
  total_paise := v_total::bigint;
  RETURN NEXT;
END $$;

-- 5) Create manual invoice
CREATE OR REPLACE FUNCTION public.admin_create_manual_invoice(
  _user_id uuid,
  _support_request_id uuid,
  _document_type text,
  _surface text,
  _line_items jsonb,
  _gst_percent numeric DEFAULT 18,
  _tax_inclusive boolean DEFAULT false,
  _due_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _payment_link_url text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  SELECT * INTO v_t FROM public._mi_compute_totals(_line_items, _gst_percent, _tax_inclusive);
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  SELECT COALESCE(full_name, display_name) INTO v_name FROM public.user_profiles WHERE user_id = _user_id;

  INSERT INTO public.manual_invoices (
    user_id, surface, support_request_id, document_type, line_items,
    gst_percent, tax_inclusive, subtotal_paise, gst_paise, total_paise,
    due_date, notes, payment_method, payment_link_url,
    billed_to_email, billed_to_name, created_by
  ) VALUES (
    _user_id, COALESCE(_surface,'creator'), _support_request_id,
    COALESCE(_document_type,'invoice'), COALESCE(_line_items,'[]'::jsonb),
    COALESCE(_gst_percent,18), COALESCE(_tax_inclusive,false),
    v_t.subtotal_paise, v_t.gst_paise, v_t.total_paise,
    _due_date, _notes, _payment_method, _payment_link_url,
    v_email, v_name, v_caller
  ) RETURNING id INTO v_id;

  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller, 'invoice_drafted', _user_id, _support_request_id, v_id,
          jsonb_build_object('total_paise', v_t.total_paise, 'doc', COALESCE(_document_type,'invoice')));

  IF _support_request_id IS NOT NULL THEN
    UPDATE public.support_requests SET status = 'quoted' WHERE id = _support_request_id AND status IN ('open','in_progress','reviewing');
  END IF;

  RETURN v_id;
END $$;

-- Update an existing manual invoice while draft
CREATE OR REPLACE FUNCTION public.admin_update_manual_invoice(
  _invoice_id uuid,
  _line_items jsonb,
  _gst_percent numeric DEFAULT NULL,
  _tax_inclusive boolean DEFAULT NULL,
  _due_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _payment_method text DEFAULT NULL,
  _payment_link_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    payment_link_url = COALESCE(_payment_link_url, payment_link_url)
  WHERE id = _invoice_id;
END $$;

-- Issue
CREATE OR REPLACE FUNCTION public.admin_issue_manual_invoice(_invoice_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid(); v_cur record;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_cur FROM public.manual_invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_cur.status <> 'draft' THEN RAISE EXCEPTION 'only_draft_can_issue'; END IF;
  UPDATE public.manual_invoices SET status='issued', issued_at=now() WHERE id=_invoice_id;
  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller,'invoice_issued', v_cur.user_id, v_cur.support_request_id, _invoice_id, '{}'::jsonb);
END $$;

-- Mark paid
CREATE OR REPLACE FUNCTION public.admin_mark_invoice_paid(
  _invoice_id uuid, _payment_method text DEFAULT NULL, _payment_reference text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

-- Void
CREATE OR REPLACE FUNCTION public.admin_void_manual_invoice(_invoice_id uuid, _reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid(); v_cur record;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_cur FROM public.manual_invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_cur.id IS NULL THEN RAISE EXCEPTION 'invoice_not_found'; END IF;
  IF v_cur.status = 'paid' THEN RAISE EXCEPTION 'paid_cannot_be_voided_use_credit_note'; END IF;
  UPDATE public.manual_invoices SET status='void', voided_at=now(),
    notes = CASE WHEN _reason IS NULL THEN notes ELSE COALESCE(notes,'') || E'\n[void] ' || _reason END
  WHERE id=_invoice_id;
  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller,'invoice_voided', v_cur.user_id, v_cur.support_request_id, _invoice_id, jsonb_build_object('reason', _reason));
END $$;

-- Provision creator plan (changes plan_tier + optional storage grant + updates request)
CREATE OR REPLACE FUNCTION public.admin_provision_creator_plan(
  _user_id uuid,
  _support_request_id uuid,
  _plan_tier text,
  _storage_grant_gb integer DEFAULT 0,
  _grant_expires_at timestamptz DEFAULT NULL,
  _notes text DEFAULT NULL,
  _manual_invoice_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_alloc uuid;
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _plan_tier NOT IN ('free','creator','pro','studio') THEN RAISE EXCEPTION 'invalid_plan_tier'; END IF;

  UPDATE public.user_profiles SET plan_tier = _plan_tier WHERE user_id = _user_id;

  IF COALESCE(_storage_grant_gb,0) > 0 THEN
    INSERT INTO public.storage_allocations(user_id, allocated_gb, source, granted_by, expires_at, notes)
    VALUES (_user_id, _storage_grant_gb, 'admin_grant', v_caller, _grant_expires_at,
            COALESCE(_notes, 'Founder-assisted plan provisioning'))
    RETURNING id INTO v_alloc;
    IF _manual_invoice_id IS NOT NULL THEN
      UPDATE public.manual_invoices SET storage_allocation_id = v_alloc WHERE id = _manual_invoice_id;
    END IF;
  END IF;

  IF _support_request_id IS NOT NULL THEN
    UPDATE public.support_requests SET
      status = 'provisioned',
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
        'provisioned_plan', _plan_tier,
        'provisioned_storage_gb', COALESCE(_storage_grant_gb,0),
        'provisioned_at', now(),
        'provisioned_by', v_caller,
        'manual_invoice_id', _manual_invoice_id
      )
    WHERE id = _support_request_id;
  END IF;

  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller,'plan_provisioned', _user_id, _support_request_id, _manual_invoice_id,
          jsonb_build_object('plan_tier', _plan_tier, 'storage_grant_gb', COALESCE(_storage_grant_gb,0), 'allocation_id', v_alloc));

  RETURN jsonb_build_object('ok', true, 'allocation_id', v_alloc);
END $$;

-- Provision studio plan (records on support_request only — studio entitlement model not yet in place)
CREATE OR REPLACE FUNCTION public.admin_provision_studio_plan(
  _user_id uuid,
  _support_request_id uuid,
  _package_label text,
  _notes text DEFAULT NULL,
  _manual_invoice_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.is_super_admin(v_caller)) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _support_request_id IS NOT NULL THEN
    UPDATE public.support_requests SET
      status='provisioned',
      metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
        'provisioned_studio_package', _package_label,
        'provisioned_at', now(),
        'provisioned_by', v_caller,
        'provisioning_notes', _notes,
        'manual_invoice_id', _manual_invoice_id
      )
    WHERE id = _support_request_id;
  END IF;
  INSERT INTO public.commercial_audit_log(actor_id, action, subject_user_id, support_request_id, manual_invoice_id, details)
  VALUES (v_caller,'studio_plan_provisioned', _user_id, _support_request_id, _manual_invoice_id,
          jsonb_build_object('package', _package_label, 'notes', _notes));
  RETURN jsonb_build_object('ok', true);
END $$;

-- Mark overdue (called by client query is fine; provide helper)
CREATE OR REPLACE FUNCTION public.sweep_manual_invoices_overdue() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  UPDATE public.manual_invoices SET status='overdue'
   WHERE status='issued' AND due_date IS NOT NULL AND due_date < CURRENT_DATE;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
