
CREATE OR REPLACE FUNCTION public.acquisition_requests_freeze_buyer_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow buyer to edit their own submission; owner/admin cannot mutate buyer-submitted fields.
  IF auth.uid() = OLD.buyer_user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_user_id   IS DISTINCT FROM OLD.buyer_user_id
     OR NEW.title_id     IS DISTINCT FROM OLD.title_id
     OR NEW.offer_amount IS DISTINCT FROM OLD.offer_amount
     OR NEW.offer_currency IS DISTINCT FROM OLD.offer_currency
     OR NEW.territories  IS DISTINCT FROM OLD.territories
     OR NEW.rights       IS DISTINCT FROM OLD.rights
     OR NEW.message      IS DISTINCT FROM OLD.message
  THEN
    RAISE EXCEPTION 'Only the buyer can modify buyer-submitted fields on an acquisition request'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_acquisition_requests_freeze_buyer_cols ON public.acquisition_requests;
CREATE TRIGGER trg_acquisition_requests_freeze_buyer_cols
BEFORE UPDATE ON public.acquisition_requests
FOR EACH ROW EXECUTE FUNCTION public.acquisition_requests_freeze_buyer_cols();
