
-- Restrict owner updates to only allowed columns via trigger

CREATE OR REPLACE FUNCTION public.enforce_acquisition_owner_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_user_id = auth.uid() AND (NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id) THEN
    RAISE EXCEPTION 'Owners cannot modify buyer_user_id on acquisition_requests';
  END IF;

  IF OLD.owner_user_id = auth.uid() THEN
    IF NEW.title_id IS DISTINCT FROM OLD.title_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.rights IS DISTINCT FROM OLD.rights
       OR NEW.territories IS DISTINCT FROM OLD.territories
       OR NEW.term_months IS DISTINCT FROM OLD.term_months
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Owners can only update status, counter terms, and response fields on acquisition_requests';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_acquisition_owner_update_scope ON public.acquisition_requests;
CREATE TRIGGER trg_enforce_acquisition_owner_update_scope
BEFORE UPDATE ON public.acquisition_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_acquisition_owner_update_scope();


CREATE OR REPLACE FUNCTION public.enforce_commercial_request_owner_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.owner_user_id = auth.uid() THEN
    IF NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id
       OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
       OR NEW.title_id IS DISTINCT FROM OLD.title_id
       OR NEW.terms IS DISTINCT FROM OLD.terms
       OR NEW.interest_summary IS DISTINCT FROM OLD.interest_summary
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Owners can only update state, state_changed_by, and state_changed_at on commercial_requests';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_commercial_request_owner_update_scope ON public.commercial_requests;
CREATE TRIGGER trg_enforce_commercial_request_owner_update_scope
BEFORE UPDATE ON public.commercial_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_commercial_request_owner_update_scope();
