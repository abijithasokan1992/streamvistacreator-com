
-- =========================================================================
-- 1. Distribution offer tamper-proofing trigger
-- =========================================================================
CREATE OR REPLACE FUNCTION public.enforce_dpo_owner_write_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := current_setting('role', true);
  v_is_privileged boolean := false;
BEGIN
  -- Service role and DB-owner writes bypass entirely.
  IF v_role = 'service_role' OR v_role = 'supabase_admin' OR v_role = 'postgres' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL AND (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'platform_owner'::app_role)
  ) THEN
    v_is_privileged := true;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  -- For non-privileged callers (i.e. the creator via the accept/reject policy),
  -- immutably lock every commercial and structural field. Only status flips
  -- offered -> accepted/rejected plus their timestamps are allowed.
  IF NEW.program_name        IS DISTINCT FROM OLD.program_name
  OR NEW.rights_scope_json   IS DISTINCT FROM OLD.rights_scope_json
  OR NEW.channel_scope_json  IS DISTINCT FROM OLD.channel_scope_json
  OR NEW.territory_scope_json IS DISTINCT FROM OLD.territory_scope_json
  OR NEW.term_years          IS DISTINCT FROM OLD.term_years
  OR NEW.term_start_date     IS DISTINCT FROM OLD.term_start_date
  OR NEW.term_end_date       IS DISTINCT FROM OLD.term_end_date
  OR NEW.is_non_exclusive    IS DISTINCT FROM OLD.is_non_exclusive
  OR NEW.revenue_model       IS DISTINCT FROM OLD.revenue_model
  OR NEW.platform_share_pct        IS DISTINCT FROM OLD.platform_share_pct
  OR NEW.streamvista_share_pct     IS DISTINCT FROM OLD.streamvista_share_pct
  OR NEW.rights_holder_share_pct   IS DISTINCT FROM OLD.rights_holder_share_pct
  OR NEW.termination_notice_days   IS DISTINCT FROM OLD.termination_notice_days
  OR NEW.termination_fee_amount    IS DISTINCT FROM OLD.termination_fee_amount
  OR NEW.termination_fee_currency  IS DISTINCT FROM OLD.termination_fee_currency
  OR NEW.legal_text_snapshot IS DISTINCT FROM OLD.legal_text_snapshot
  OR NEW.title_id            IS DISTINCT FROM OLD.title_id
  OR NEW.workspace_id        IS DISTINCT FROM OLD.workspace_id
  OR NEW.creator_user_id     IS DISTINCT FROM OLD.creator_user_id
  OR NEW.offered_by_admin    IS DISTINCT FROM OLD.offered_by_admin
  OR NEW.offered_at          IS DISTINCT FROM OLD.offered_at
  THEN
    RAISE EXCEPTION 'Distribution offer terms are immutable once submitted. Only status accept/reject is allowed.'
      USING ERRCODE = '42501';
  END IF;

  -- Status: only offered -> accepted / rejected
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'offered'::distribution_offer_status THEN
      RAISE EXCEPTION 'Only offers currently in "offered" state can be accepted or rejected.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('accepted'::distribution_offer_status, 'rejected'::distribution_offer_status) THEN
      RAISE EXCEPTION 'Structural status transitions are restricted to service role or super_admin.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Auto-stamp acceptance/rejection timestamp on the writing side, so client
  -- can't leave them null or backdate.
  IF NEW.status = 'accepted'::distribution_offer_status AND OLD.status = 'offered'::distribution_offer_status THEN
    NEW.accepted_at := now();
  ELSIF NEW.status = 'rejected'::distribution_offer_status AND OLD.status = 'offered'::distribution_offer_status THEN
    NEW.rejected_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_dpo_owner_write_scope ON public.distribution_program_offers;
CREATE TRIGGER trg_enforce_dpo_owner_write_scope
BEFORE UPDATE ON public.distribution_program_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_dpo_owner_write_scope();

-- Ensure super_admin has full override on the table (parallels dpo_admin_all).
DROP POLICY IF EXISTS "dpo_super_admin_all" ON public.distribution_program_offers;
CREATE POLICY "dpo_super_admin_all"
  ON public.distribution_program_offers
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- =========================================================================
-- 2. Admin onboarding review RPC (approve / reject)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_review_onboarding_request(
  _request_id uuid,
  _decision text,
  _notes text DEFAULT NULL
)
RETURNS public.onboarding_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.onboarding_requests;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'super_admin or admin role required' USING ERRCODE = '42501';
  END IF;

  IF _decision NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid decision: %', _decision USING ERRCODE = '22023';
  END IF;

  UPDATE public.onboarding_requests
     SET onboarding_status = _decision,
         link_metadata = COALESCE(link_metadata, '{}'::jsonb)
           || jsonb_build_object(
                'reviewed_by', v_uid,
                'reviewed_at', now(),
                'review_notes', COALESCE(_notes, ''),
                'review_decision', _decision
              )
   WHERE id = _request_id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'onboarding request not found: %', _request_id USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    INSERT INTO public.onboarding_audit_log (actor_id, action, target_id, metadata)
    VALUES (v_uid, 'review_' || _decision, _request_id,
            jsonb_build_object('notes', COALESCE(_notes, '')));
  EXCEPTION WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL;
  END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_onboarding_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_onboarding_request(uuid, text, text) TO authenticated, service_role;

-- =========================================================================
-- 3. Admin title workflow toggle RPC
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_title_status(
  _title_id uuid,
  _new_status text
)
RETURNS public.content_titles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.content_titles;
  v_status public.content_status;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'super_admin or admin role required' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_status := _new_status::public.content_status;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid content status: %', _new_status USING ERRCODE = '22023';
  END;

  UPDATE public.content_titles
     SET status = v_status,
         approved_at = CASE WHEN v_status = 'approved'::content_status THEN now() ELSE approved_at END,
         approved_by = CASE WHEN v_status = 'approved'::content_status THEN v_uid ELSE approved_by END,
         published_at = CASE WHEN v_status = 'published'::content_status THEN now() ELSE published_at END,
         published_by = CASE WHEN v_status = 'published'::content_status THEN v_uid ELSE published_by END,
         updated_at = now()
   WHERE id = _title_id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'title not found: %', _title_id USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_title_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_title_status(uuid, text) TO authenticated, service_role;
