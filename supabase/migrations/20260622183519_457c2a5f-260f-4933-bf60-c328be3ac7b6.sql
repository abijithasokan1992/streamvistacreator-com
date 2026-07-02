
-- 1) Extend deal_memos with operational columns ----------------------------
ALTER TABLE public.deal_memos
  ADD COLUMN IF NOT EXISTS ops_stage text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_notes text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS paid_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_notes text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_notes text,
  ADD COLUMN IF NOT EXISTS close_outcome text,
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_share_paise bigint,
  ADD COLUMN IF NOT EXISTS owner_share_paise bigint,
  ADD COLUMN IF NOT EXISTS owner_share_pct numeric;

DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_ops_stage_check CHECK (ops_stage IN (
      'draft','pending_internal_approval','approved','invoice_pending','invoice_issued',
      'payment_pending','partially_paid','paid','delivery_preparing','delivered',
      'payout_pending','payout_marked','closed_won','closed_lost','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_approval_status_check CHECK (approval_status IN ('not_required','pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_payment_status_check CHECK (payment_status IN ('not_started','pending','partially_paid','paid','failed','waived','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_payment_mode_check CHECK (payment_mode IS NULL OR payment_mode IN ('razorpay','bank_transfer','manual_off_platform','waived','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_delivery_status_check CHECK (delivery_status IN ('not_required','not_started','preparing','ready','shared','delivered','failed','revoked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.deal_memos
    ADD CONSTRAINT deal_memos_close_outcome_check CHECK (close_outcome IS NULL OR close_outcome IN ('won','lost','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Link manual_invoices to deals --------------------------------
ALTER TABLE public.manual_invoices
  ADD COLUMN IF NOT EXISTS deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_manual_invoices_deal ON public.manual_invoices(deal_memo_id);

-- 3) Deal deliveries ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_memo_id uuid NOT NULL REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_org_name text,
  recipient_email text,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_required','not_started','preparing','ready','shared','delivered','failed','revoked')),
  method text NOT NULL DEFAULT 'secure_download'
    CHECK (method IN ('screening_only','secure_download','vault_share','external_transfer','offline_physical','other')),
  package_notes text,
  asset_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  share_url text,
  expires_at timestamptz,
  shared_at timestamptz,
  delivered_at timestamptz,
  internal_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_deliveries_deal ON public.deal_deliveries(deal_memo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_deliveries TO authenticated;
GRANT ALL ON public.deal_deliveries TO service_role;
ALTER TABLE public.deal_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_deliveries_admin_all" ON public.deal_deliveries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "deal_deliveries_buyer_read" ON public.deal_deliveries FOR SELECT TO authenticated
  USING (buyer_user_id IS NOT NULL AND buyer_user_id = auth.uid());
CREATE POLICY "deal_deliveries_owner_read" ON public.deal_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = deal_deliveries.title_id AND t.owner_user_id = auth.uid()));
CREATE TRIGGER trg_deal_deliveries_updated BEFORE UPDATE ON public.deal_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Deal payouts (founder payout intent) -------------------------
CREATE TABLE IF NOT EXISTS public.deal_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_memo_id uuid NOT NULL REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  beneficiary_type text NOT NULL DEFAULT 'creator'
    CHECK (beneficiary_type IN ('creator','rights_owner','studio','partner','other')),
  beneficiary_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  beneficiary_label text,
  beneficiary_email text,
  basis text NOT NULL DEFAULT 'percentage'
    CHECK (basis IN ('fixed','percentage','revenue_share','minimum_guarantee_share','custom')),
  share_pct numeric,
  gross_amount_paise bigint NOT NULL DEFAULT 0,
  platform_share_paise bigint NOT NULL DEFAULT 0,
  payout_amount_paise bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','scheduled','marked_paid','on_hold','cancelled')),
  payment_reference text,
  internal_notes text,
  paid_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_payouts_deal ON public.deal_payouts(deal_memo_id);
CREATE INDEX IF NOT EXISTS idx_deal_payouts_beneficiary ON public.deal_payouts(beneficiary_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_payouts TO authenticated;
GRANT ALL ON public.deal_payouts TO service_role;
ALTER TABLE public.deal_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_payouts_admin_all" ON public.deal_payouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "deal_payouts_beneficiary_read" ON public.deal_payouts FOR SELECT TO authenticated
  USING (beneficiary_user_id IS NOT NULL AND beneficiary_user_id = auth.uid());
CREATE POLICY "deal_payouts_title_owner_read" ON public.deal_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = deal_payouts.title_id AND t.owner_user_id = auth.uid()));
CREATE TRIGGER trg_deal_payouts_updated BEFORE UPDATE ON public.deal_payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Deal operations events ---------------------------------------
CREATE TABLE IF NOT EXISTS public.deal_ops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_memo_id uuid NOT NULL REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  kind text NOT NULL,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_ops_events_deal ON public.deal_ops_events(deal_memo_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.deal_ops_events TO authenticated;
GRANT ALL ON public.deal_ops_events TO service_role;
ALTER TABLE public.deal_ops_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_ops_events_admin_all" ON public.deal_ops_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6) RPCs --------------------------------------------------------

-- approval
CREATE OR REPLACE FUNCTION public.admin_deal_set_approval(
  _deal_id uuid, _decision text, _notes text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('pending','approved','rejected','not_required') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  UPDATE public.deal_memos SET
    approval_status = _decision,
    approval_notes = COALESCE(_notes, approval_notes),
    approved_by = CASE WHEN _decision='approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN _decision='approved' THEN now() ELSE approved_at END,
    rejected_by = CASE WHEN _decision='rejected' THEN auth.uid() ELSE rejected_by END,
    rejected_at = CASE WHEN _decision='rejected' THEN now() ELSE rejected_at END,
    rejection_reason = CASE WHEN _decision='rejected' THEN _notes ELSE rejection_reason END,
    ops_stage = CASE
      WHEN _decision='pending' THEN 'pending_internal_approval'
      WHEN _decision='approved' AND ops_stage IN ('draft','pending_internal_approval') THEN 'approved'
      ELSE ops_stage END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'approval_' || _decision, _notes, auth.uid(), jsonb_build_object('decision', _decision));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_set_approval(uuid,text,text) TO authenticated;

-- payment recording
CREATE OR REPLACE FUNCTION public.admin_deal_record_payment(
  _deal_id uuid, _status text, _mode text DEFAULT NULL,
  _paid_amount_paise bigint DEFAULT NULL, _reference text DEFAULT NULL,
  _notes text DEFAULT NULL, _paid_at timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('not_started','pending','partially_paid','paid','failed','waived','refunded') THEN
    RAISE EXCEPTION 'invalid payment status';
  END IF;
  UPDATE public.deal_memos SET
    payment_status = _status,
    payment_mode = COALESCE(_mode, payment_mode),
    paid_amount_paise = COALESCE(_paid_amount_paise, paid_amount_paise),
    payment_reference = COALESCE(_reference, payment_reference),
    payment_notes = COALESCE(_notes, payment_notes),
    paid_at = COALESCE(_paid_at, CASE WHEN _status='paid' THEN now() ELSE paid_at END),
    ops_stage = CASE
      WHEN _status='paid' THEN 'paid'
      WHEN _status='partially_paid' THEN 'partially_paid'
      WHEN _status='pending' AND ops_stage IN ('approved','invoice_issued') THEN 'payment_pending'
      ELSE ops_stage END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'payment_' || _status, _notes, auth.uid(),
      jsonb_build_object('mode', _mode, 'amount_paise', _paid_amount_paise, 'reference', _reference));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_record_payment(uuid,text,text,bigint,text,text,timestamptz) TO authenticated;

-- delivery upsert
CREATE OR REPLACE FUNCTION public.admin_deal_upsert_delivery(
  _deal_id uuid, _delivery_id uuid, _status text, _method text DEFAULT NULL,
  _recipient_email text DEFAULT NULL, _share_url text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL, _package_notes text DEFAULT NULL,
  _internal_notes text DEFAULT NULL, _mark_delivered boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; deal_row public.deal_memos%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO deal_row FROM public.deal_memos WHERE id = _deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'deal not found'; END IF;
  IF _delivery_id IS NULL THEN
    INSERT INTO public.deal_deliveries(
      deal_memo_id, title_id, buyer_user_id, buyer_org_name, recipient_email,
      status, method, share_url, expires_at, package_notes, internal_notes,
      shared_at, delivered_at, created_by
    ) VALUES (
      _deal_id, deal_row.title_id, deal_row.buyer_user_id, deal_row.buyer_org_name,
      COALESCE(_recipient_email, deal_row.buyer_contact_email),
      COALESCE(_status,'preparing'), COALESCE(_method,'secure_download'),
      _share_url, _expires_at, _package_notes, _internal_notes,
      CASE WHEN _status='shared' THEN now() END,
      CASE WHEN _mark_delivered OR _status='delivered' THEN now() END,
      auth.uid()
    ) RETURNING id INTO rid;
  ELSE
    UPDATE public.deal_deliveries SET
      status = COALESCE(_status, status),
      method = COALESCE(_method, method),
      recipient_email = COALESCE(_recipient_email, recipient_email),
      share_url = COALESCE(_share_url, share_url),
      expires_at = COALESCE(_expires_at, expires_at),
      package_notes = COALESCE(_package_notes, package_notes),
      internal_notes = COALESCE(_internal_notes, internal_notes),
      shared_at = CASE WHEN _status='shared' AND shared_at IS NULL THEN now() ELSE shared_at END,
      delivered_at = CASE WHEN (_mark_delivered OR _status='delivered') AND delivered_at IS NULL THEN now() ELSE delivered_at END
      WHERE id = _delivery_id RETURNING id INTO rid;
  END IF;

  UPDATE public.deal_memos SET
    delivery_status = COALESCE(_status, delivery_status),
    delivered_at = CASE WHEN _mark_delivered OR _status='delivered' THEN now() ELSE delivered_at END,
    delivery_notes = COALESCE(_package_notes, delivery_notes),
    ops_stage = CASE
      WHEN _mark_delivered OR _status='delivered' THEN 'delivered'
      WHEN _status='preparing' THEN 'delivery_preparing'
      ELSE ops_stage END
    WHERE id = _deal_id;

  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'delivery_' || COALESCE(_status,'updated'), _package_notes, auth.uid(),
      jsonb_build_object('delivery_id', rid, 'method', _method));
  RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_upsert_delivery(uuid,uuid,text,text,text,text,timestamptz,text,text,boolean) TO authenticated;

-- payout intent upsert
CREATE OR REPLACE FUNCTION public.admin_deal_upsert_payout(
  _deal_id uuid, _payout_id uuid,
  _beneficiary_type text DEFAULT 'creator',
  _beneficiary_user_id uuid DEFAULT NULL,
  _beneficiary_label text DEFAULT NULL,
  _beneficiary_email text DEFAULT NULL,
  _basis text DEFAULT 'percentage',
  _share_pct numeric DEFAULT NULL,
  _gross_amount_paise bigint DEFAULT NULL,
  _platform_share_paise bigint DEFAULT NULL,
  _payout_amount_paise bigint DEFAULT NULL,
  _status text DEFAULT 'pending',
  _reference text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _mark_paid boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; deal_row public.deal_memos%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO deal_row FROM public.deal_memos WHERE id = _deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'deal not found'; END IF;

  IF _payout_id IS NULL THEN
    INSERT INTO public.deal_payouts(
      deal_memo_id, title_id, beneficiary_type, beneficiary_user_id,
      beneficiary_label, beneficiary_email, basis, share_pct,
      gross_amount_paise, platform_share_paise, payout_amount_paise,
      status, payment_reference, internal_notes,
      paid_at, created_by
    ) VALUES (
      _deal_id, deal_row.title_id, _beneficiary_type, _beneficiary_user_id,
      _beneficiary_label, _beneficiary_email, _basis, _share_pct,
      COALESCE(_gross_amount_paise, deal_row.amount_paise, 0),
      COALESCE(_platform_share_paise, deal_row.platform_share_paise, 0),
      COALESCE(_payout_amount_paise, deal_row.owner_share_paise, 0),
      CASE WHEN _mark_paid THEN 'marked_paid' ELSE _status END,
      _reference, _notes,
      CASE WHEN _mark_paid THEN now() END,
      auth.uid()
    ) RETURNING id INTO rid;
  ELSE
    UPDATE public.deal_payouts SET
      beneficiary_type = COALESCE(_beneficiary_type, beneficiary_type),
      beneficiary_user_id = COALESCE(_beneficiary_user_id, beneficiary_user_id),
      beneficiary_label = COALESCE(_beneficiary_label, beneficiary_label),
      beneficiary_email = COALESCE(_beneficiary_email, beneficiary_email),
      basis = COALESCE(_basis, basis),
      share_pct = COALESCE(_share_pct, share_pct),
      gross_amount_paise = COALESCE(_gross_amount_paise, gross_amount_paise),
      platform_share_paise = COALESCE(_platform_share_paise, platform_share_paise),
      payout_amount_paise = COALESCE(_payout_amount_paise, payout_amount_paise),
      status = CASE WHEN _mark_paid THEN 'marked_paid' ELSE COALESCE(_status, status) END,
      payment_reference = COALESCE(_reference, payment_reference),
      internal_notes = COALESCE(_notes, internal_notes),
      paid_at = CASE WHEN _mark_paid AND paid_at IS NULL THEN now() ELSE paid_at END
      WHERE id = _payout_id RETURNING id INTO rid;
  END IF;

  UPDATE public.deal_memos SET
    ops_stage = CASE
      WHEN _mark_paid THEN 'payout_marked'
      WHEN ops_stage IN ('paid','delivered') THEN 'payout_pending'
      ELSE ops_stage END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'payout_' || CASE WHEN _mark_paid THEN 'marked_paid' ELSE COALESCE(_status,'updated') END,
      _notes, auth.uid(), jsonb_build_object('payout_id', rid, 'amount_paise', _payout_amount_paise));
  RETURN rid;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_upsert_payout(uuid,uuid,text,uuid,text,text,text,numeric,bigint,bigint,bigint,text,text,text,boolean) TO authenticated;

-- close deal
CREATE OR REPLACE FUNCTION public.admin_deal_close(
  _deal_id uuid, _outcome text, _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _outcome NOT IN ('won','lost','cancelled') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
  UPDATE public.deal_memos SET
    close_outcome = _outcome,
    close_reason = _reason,
    closed_by = auth.uid(),
    closed_at = now(),
    ops_stage = CASE _outcome WHEN 'won' THEN 'closed_won' WHEN 'lost' THEN 'closed_lost' ELSE 'cancelled' END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'closed_' || _outcome, _reason, auth.uid(), jsonb_build_object('outcome', _outcome));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_close(uuid,text,text) TO authenticated;

-- link an invoice to a deal
CREATE OR REPLACE FUNCTION public.admin_deal_link_invoice(_deal_id uuid, _invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.manual_invoices SET deal_memo_id = _deal_id WHERE id = _invoice_id;
  UPDATE public.deal_memos SET ops_stage =
    CASE WHEN ops_stage IN ('draft','approved','pending_internal_approval','invoice_pending')
    THEN 'invoice_issued' ELSE ops_stage END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'invoice_linked', NULL, auth.uid(), jsonb_build_object('invoice_id', _invoice_id));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_deal_link_invoice(uuid,uuid) TO authenticated;
