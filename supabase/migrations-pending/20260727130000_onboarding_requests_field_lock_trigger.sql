-- SECURITY FIX (QUARANTINED — do NOT apply without explicit approval)
--
-- Finding: PRICE_MANIPULATION / onboarding_requests_ineffective_update_check
--
-- The existing `onboarding_requests_owner_update` RLS policy tries to prevent
-- owners from tampering with payment_status, onboarding_status, access_code,
-- final_price, base_price, promo_code and Razorpay IDs by using correlated
-- subqueries that select the same row it is checking (SELECT o.<col> FROM
-- onboarding_requests o WHERE o.id = onboarding_requests.id). In Postgres
-- RLS, those subqueries observe the already-updated row at WITH CHECK time,
-- so every comparison degenerates to `NEW = NEW` and never blocks a change.
--
-- Fix: install a BEFORE UPDATE trigger that compares OLD vs NEW, mirroring
-- the pattern already used for billing_orders.
--
-- No app behavior change: owners already have no legitimate reason to touch
-- these fields — payment/approval flow through the Razorpay webhook and admin
-- review RPCs, both of which run as service_role and therefore bypass RLS
-- and this trigger.

CREATE OR REPLACE FUNCTION public.trg_enforce_onboarding_owner_field_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := current_setting('request.jwt.claim.role', true) = 'service_role'
                     OR current_user IN ('postgres', 'service_role');
  is_admin boolean := auth.uid() IS NOT NULL
                     AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
BEGIN
  -- service_role / admin bypass — payment webhook, admin review RPCs
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  -- Owner cannot mutate any of the locked fields on an existing row.
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     OR NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status
     OR NEW.access_code IS DISTINCT FROM OLD.access_code
     OR NEW.final_price IS DISTINCT FROM OLD.final_price
     OR NEW.base_price IS DISTINCT FROM OLD.base_price
     OR NEW.promo_code IS DISTINCT FROM OLD.promo_code
     OR NEW.razorpay_order_id IS DISTINCT FROM OLD.razorpay_order_id
     OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
     OR NEW.razorpay_signature IS DISTINCT FROM OLD.razorpay_signature
  THEN
    RAISE EXCEPTION 'Only admin/service role may modify payment or approval fields on onboarding_requests'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_enforce_onboarding_owner_field_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_onboarding_owner_field_lock ON public.onboarding_requests;
CREATE TRIGGER trg_enforce_onboarding_owner_field_lock
  BEFORE UPDATE ON public.onboarding_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_onboarding_owner_field_lock();
