-- =========================================================
-- Security hardening: content_approvals INSERT restriction
-- =========================================================
DROP POLICY IF EXISTS ca_insert_self ON public.content_approvals;

CREATE POLICY ca_insert_authorized
ON public.content_approvals
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND (
    -- platform admins
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
    -- reviewers acting on their assignments
    OR has_role(auth.uid(), 'qc_reviewer'::app_role)
    OR has_role(auth.uid(), 'legal_reviewer'::app_role)
    -- title owner recording their own decision
    OR EXISTS (
      SELECT 1 FROM public.content_titles t
      WHERE t.id = content_approvals.title_id
        AND t.owner_user_id = auth.uid()
    )
  )
);

-- =========================================================
-- Security hardening: acquisition_requests buyer UPDATE freeze
-- =========================================================
-- WITH CHECK already blocks counter_amount/terms/responded_*. Add a
-- trigger to freeze commercial columns (offer_amount, deal_terms,
-- message, attachments) once a buyer submits, so buyers can only
-- transition status pending->withdrawn without renegotiating in place.

CREATE OR REPLACE FUNCTION public.acquisition_requests_freeze_buyer_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins and the owner bypass the freeze
  IF has_role(auth.uid(), 'admin'::app_role)
     OR is_super_admin(auth.uid())
     OR NEW.owner_user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- For buyer-owned rows, block edits to commercial columns
  IF NEW.buyer_user_id = auth.uid() THEN
    IF NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
       OR NEW.deal_terms IS DISTINCT FROM OLD.deal_terms
       OR NEW.message    IS DISTINCT FROM OLD.message
       OR NEW.attachments IS DISTINCT FROM OLD.attachments
       OR NEW.title_id   IS DISTINCT FROM OLD.title_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id THEN
      RAISE EXCEPTION 'Buyers cannot modify commercial fields on acquisition_requests (row %). Withdraw and resubmit instead.', OLD.id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acq_freeze_buyer_edits ON public.acquisition_requests;
CREATE TRIGGER trg_acq_freeze_buyer_edits
BEFORE UPDATE ON public.acquisition_requests
FOR EACH ROW
EXECUTE FUNCTION public.acquisition_requests_freeze_buyer_edits();