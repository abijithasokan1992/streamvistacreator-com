
-- =========================================================================
-- Security fix: isolate admin-only note columns from owner/buyer readers
-- Splits admin-only fields on commercial_requests, deal_memos, and
-- title_commercial_profiles into admin-only sibling tables so RLS on the
-- base table can safely allow owner/buyer SELECT without leaking internal
-- admin commentary.
-- =========================================================================

-- ---------- commercial_requests_admin ----------
CREATE TABLE IF NOT EXISTS public.commercial_requests_admin (
  request_id uuid PRIMARY KEY REFERENCES public.commercial_requests(id) ON DELETE CASCADE,
  admin_notes text,
  assigned_admin_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.commercial_requests_admin (request_id, admin_notes, assigned_admin_id)
SELECT id, admin_notes, assigned_admin_id
FROM public.commercial_requests
WHERE admin_notes IS NOT NULL OR assigned_admin_id IS NOT NULL
ON CONFLICT (request_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_requests_admin TO authenticated;
GRANT ALL ON public.commercial_requests_admin TO service_role;
ALTER TABLE public.commercial_requests_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage commercial_requests_admin" ON public.commercial_requests_admin;
CREATE POLICY "Admins manage commercial_requests_admin"
  ON public.commercial_requests_admin
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Refactor trigger to no longer reference NEW.admin_notes
CREATE OR REPLACE FUNCTION public.tg_log_commercial_request_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _note text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, NULL, NEW.state, auth.uid(), 'created');
    NEW.state_changed_by := auth.uid();
    NEW.state_changed_at := now();
  ELSIF TG_OP = 'UPDATE' AND NEW.state IS DISTINCT FROM OLD.state THEN
    SELECT admin_notes INTO _note FROM public.commercial_requests_admin WHERE request_id = NEW.id;
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, OLD.state, NEW.state, auth.uid(), _note);
    NEW.state_changed_at := now();
    NEW.state_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END $function$;

ALTER TABLE public.commercial_requests DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE public.commercial_requests DROP COLUMN IF EXISTS assigned_admin_id;

-- Admin helper RPCs
CREATE OR REPLACE FUNCTION public.admin_commercial_request_set_note(_request_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.commercial_requests_admin(request_id, admin_notes, updated_at, updated_by)
    VALUES (_request_id, _note, now(), auth.uid())
    ON CONFLICT (request_id) DO UPDATE
      SET admin_notes = EXCLUDED.admin_notes, updated_at = now(), updated_by = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.admin_commercial_request_set_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_commercial_request_get_note(_request_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT admin_notes FROM public.commercial_requests_admin
   WHERE request_id = _request_id
     AND public.has_role(auth.uid(),'admin');
$$;

GRANT EXECUTE ON FUNCTION public.admin_commercial_request_get_note(uuid) TO authenticated;


-- ---------- deal_memos_admin ----------
CREATE TABLE IF NOT EXISTS public.deal_memos_admin (
  deal_id uuid PRIMARY KEY REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  internal_notes text,
  approval_notes text,
  approved_by uuid,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  payment_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.deal_memos_admin
  (deal_id, internal_notes, approval_notes, approved_by, rejected_by, rejected_at, rejection_reason, payment_notes)
SELECT id, internal_notes, approval_notes, approved_by, rejected_by, rejected_at, rejection_reason, payment_notes
FROM public.deal_memos
ON CONFLICT (deal_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_memos_admin TO authenticated;
GRANT ALL ON public.deal_memos_admin TO service_role;
ALTER TABLE public.deal_memos_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage deal_memos_admin" ON public.deal_memos_admin;
CREATE POLICY "Admins manage deal_memos_admin"
  ON public.deal_memos_admin
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Refactor admin RPCs to write to sibling table
CREATE OR REPLACE FUNCTION public.admin_deal_set_approval(_deal_id uuid, _decision text, _notes text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _decision NOT IN ('pending','approved','rejected','not_required') THEN RAISE EXCEPTION 'invalid decision'; END IF;

  INSERT INTO public.deal_memos_admin(deal_id, approval_notes, approved_by, rejected_by, rejected_at, rejection_reason, updated_at)
    VALUES (
      _deal_id,
      _notes,
      CASE WHEN _decision='approved' THEN auth.uid() ELSE NULL END,
      CASE WHEN _decision='rejected' THEN auth.uid() ELSE NULL END,
      CASE WHEN _decision='rejected' THEN now() ELSE NULL END,
      CASE WHEN _decision='rejected' THEN _notes ELSE NULL END,
      now()
    )
    ON CONFLICT (deal_id) DO UPDATE SET
      approval_notes  = COALESCE(EXCLUDED.approval_notes, public.deal_memos_admin.approval_notes),
      approved_by     = CASE WHEN _decision='approved' THEN auth.uid() ELSE public.deal_memos_admin.approved_by END,
      rejected_by     = CASE WHEN _decision='rejected' THEN auth.uid() ELSE public.deal_memos_admin.rejected_by END,
      rejected_at     = CASE WHEN _decision='rejected' THEN now() ELSE public.deal_memos_admin.rejected_at END,
      rejection_reason= CASE WHEN _decision='rejected' THEN _notes ELSE public.deal_memos_admin.rejection_reason END,
      updated_at      = now();

  UPDATE public.deal_memos SET
    approval_status = _decision,
    approved_at = CASE WHEN _decision='approved' THEN now() ELSE approved_at END,
    ops_stage = CASE
      WHEN _decision='pending' THEN 'pending_internal_approval'
      WHEN _decision='approved' AND ops_stage IN ('draft','pending_internal_approval') THEN 'approved'
      ELSE ops_stage END
    WHERE id = _deal_id;
  INSERT INTO public.deal_ops_events(deal_memo_id, kind, summary, actor_user_id, metadata)
    VALUES (_deal_id, 'approval_' || _decision, _notes, auth.uid(), jsonb_build_object('decision', _decision));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_deal_record_payment(_deal_id uuid, _status text, _mode text DEFAULT NULL::text, _paid_amount_paise bigint DEFAULT NULL::bigint, _reference text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _paid_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('not_started','pending','partially_paid','paid','failed','waived','refunded') THEN
    RAISE EXCEPTION 'invalid payment status';
  END IF;

  IF _notes IS NOT NULL THEN
    INSERT INTO public.deal_memos_admin(deal_id, payment_notes, updated_at)
      VALUES (_deal_id, _notes, now())
      ON CONFLICT (deal_id) DO UPDATE
        SET payment_notes = COALESCE(EXCLUDED.payment_notes, public.deal_memos_admin.payment_notes),
            updated_at = now();
  END IF;

  UPDATE public.deal_memos SET
    payment_status = _status,
    payment_mode = COALESCE(_mode, payment_mode),
    paid_amount_paise = COALESCE(_paid_amount_paise, paid_amount_paise),
    payment_reference = COALESCE(_reference, payment_reference),
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
END $function$;

-- Admin read/write helpers for deal_memos_admin
CREATE OR REPLACE FUNCTION public.admin_deal_get_admin_fields(_deal_id uuid)
RETURNS public.deal_memos_admin
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.deal_memos_admin
   WHERE deal_id = _deal_id
     AND public.has_role(auth.uid(),'admin');
$$;

GRANT EXECUTE ON FUNCTION public.admin_deal_get_admin_fields(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_deal_set_internal_notes(_deal_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.deal_memos_admin(deal_id, internal_notes, updated_at)
    VALUES (_deal_id, _notes, now())
    ON CONFLICT (deal_id) DO UPDATE
      SET internal_notes = EXCLUDED.internal_notes, updated_at = now();
END $$;

GRANT EXECUTE ON FUNCTION public.admin_deal_set_internal_notes(uuid, text) TO authenticated;

ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS internal_notes;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS approval_notes;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS approved_by;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS rejected_by;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS rejected_at;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE public.deal_memos DROP COLUMN IF EXISTS payment_notes;


-- ---------- title_commercial_profiles_admin ----------
CREATE TABLE IF NOT EXISTS public.title_commercial_profiles_admin (
  profile_id uuid PRIMARY KEY REFERENCES public.title_commercial_profiles(id) ON DELETE CASCADE,
  admin_internal_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.title_commercial_profiles_admin (profile_id, admin_internal_notes)
SELECT id, admin_internal_notes FROM public.title_commercial_profiles
WHERE admin_internal_notes IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_commercial_profiles_admin TO authenticated;
GRANT ALL ON public.title_commercial_profiles_admin TO service_role;
ALTER TABLE public.title_commercial_profiles_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tcp_admin" ON public.title_commercial_profiles_admin;
CREATE POLICY "Admins manage tcp_admin"
  ON public.title_commercial_profiles_admin
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.title_commercial_profiles DROP COLUMN IF EXISTS admin_internal_notes;

CREATE OR REPLACE FUNCTION public.admin_tcp_set_internal_notes(_profile_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.title_commercial_profiles_admin(profile_id, admin_internal_notes, updated_at, updated_by)
    VALUES (_profile_id, _notes, now(), auth.uid())
    ON CONFLICT (profile_id) DO UPDATE
      SET admin_internal_notes = EXCLUDED.admin_internal_notes,
          updated_at = now(),
          updated_by = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.admin_tcp_set_internal_notes(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tcp_get_internal_notes(_profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT admin_internal_notes FROM public.title_commercial_profiles_admin
   WHERE profile_id = _profile_id
     AND public.has_role(auth.uid(),'admin');
$$;

GRANT EXECUTE ON FUNCTION public.admin_tcp_get_internal_notes(uuid) TO authenticated;
