
CREATE OR REPLACE FUNCTION public.onboarding_requests_scrub_anon_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Anonymous insert path: strip any sensitive/server-managed fields so
  -- unauthenticated callers cannot inject fake payment IDs, link to other
  -- payment flows, or claim MFI proof paths. These fields must only be set
  -- by trusted server flows (edge functions / webhooks running as service role).
  IF auth.role() = 'anon' OR NEW.submitter_user_id IS NULL THEN
    NEW.razorpay_order_id   := NULL;
    NEW.razorpay_payment_id := NULL;
    NEW.mfi_proof_path      := NULL;
    NEW.payment_status      := 'pending';
    NEW.submitter_user_id   := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS onboarding_requests_scrub_anon_fields ON public.onboarding_requests;
CREATE TRIGGER onboarding_requests_scrub_anon_fields
BEFORE INSERT ON public.onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.onboarding_requests_scrub_anon_fields();
