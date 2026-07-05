
-- Tighten acquisition_requests INSERT: buyers must submit as 'pending' with no pre-set response/counter fields.
DROP POLICY IF EXISTS acq_buyer_insert ON public.acquisition_requests;
CREATE POLICY acq_buyer_insert ON public.acquisition_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND status = 'pending'::acquisition_status
    AND counter_amount IS NULL
    AND counter_terms IS NULL
    AND responded_at IS NULL
    AND responded_by IS NULL
  );

-- Enforce column-level scoping for UPDATE via a SECURITY DEFINER trigger.
-- Buyer may edit only message. Owner may set status (with valid transition),
-- counter_amount, counter_terms, responded_at, responded_by. Admins unrestricted.
CREATE OR REPLACE FUNCTION public.enforce_acq_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Admins bypass column-scope checks (RLS policy still gates the row).
  IF public.has_role(uid, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Owner branch
  IF uid = OLD.owner_user_id THEN
    IF NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.title_id IS DISTINCT FROM OLD.title_id
      OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
      OR NEW.offer_currency IS DISTINCT FROM OLD.offer_currency
      OR NEW.rights::text IS DISTINCT FROM OLD.rights::text
      OR NEW.territories IS DISTINCT FROM OLD.territories
      OR NEW.message IS DISTINCT FROM OLD.message
    THEN
      RAISE EXCEPTION 'owners cannot modify buyer-submitted terms';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        (OLD.status = 'pending'::acquisition_status
           AND NEW.status IN ('countered'::acquisition_status,'accepted'::acquisition_status,'rejected'::acquisition_status))
        OR (OLD.status = 'countered'::acquisition_status
           AND NEW.status IN ('accepted'::acquisition_status,'rejected'::acquisition_status))
      ) THEN
        RAISE EXCEPTION 'invalid status transition from % to %', OLD.status, NEW.status;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Buyer branch (buyer is not also the owner)
  IF uid = OLD.buyer_user_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.buyer_user_id IS DISTINCT FROM OLD.buyer_user_id
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.title_id IS DISTINCT FROM OLD.title_id
      OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
      OR NEW.offer_currency IS DISTINCT FROM OLD.offer_currency
      OR NEW.rights::text IS DISTINCT FROM OLD.rights::text
      OR NEW.territories IS DISTINCT FROM OLD.territories
      OR NEW.counter_amount IS DISTINCT FROM OLD.counter_amount
      OR NEW.counter_terms::text IS DISTINCT FROM OLD.counter_terms::text
      OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
      OR NEW.responded_by IS DISTINCT FROM OLD.responded_by
    THEN
      RAISE EXCEPTION 'buyers may only edit the message field';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not authorized';
END;
$$;

DROP TRIGGER IF EXISTS trg_acq_enforce_update ON public.acquisition_requests;
CREATE TRIGGER trg_acq_enforce_update
  BEFORE UPDATE ON public.acquisition_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_acq_update();
