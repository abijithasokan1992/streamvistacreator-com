-- Phase 1: Owner field-lock triggers for onboarding_requests + hard_disk_intakes
-- Ported verbatim from supabase/migrations-pending/20260727130000_onboarding_requests_field_lock_trigger.sql

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
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status      IS DISTINCT FROM OLD.payment_status
     OR NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status
     OR NEW.access_code       IS DISTINCT FROM OLD.access_code
     OR NEW.final_price       IS DISTINCT FROM OLD.final_price
     OR NEW.base_price        IS DISTINCT FROM OLD.base_price
     OR NEW.promo_code        IS DISTINCT FROM OLD.promo_code
     OR NEW.razorpay_order_id   IS DISTINCT FROM OLD.razorpay_order_id
     OR NEW.razorpay_payment_id IS DISTINCT FROM OLD.razorpay_payment_id
     OR NEW.amount_paid_paise   IS DISTINCT FROM OLD.amount_paid_paise
     OR NEW.plan_type           IS DISTINCT FROM OLD.plan_type
     OR NEW.selected_cycle      IS DISTINCT FROM OLD.selected_cycle
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

CREATE OR REPLACE FUNCTION public.trg_enforce_hard_disk_intakes_admin_notes_lock()
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
  IF is_service OR is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Only admin/service role may modify admin_notes on hard_disk_intakes'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_enforce_hard_disk_intakes_admin_notes_lock() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_hard_disk_intakes_admin_notes_lock ON public.hard_disk_intakes;
CREATE TRIGGER trg_enforce_hard_disk_intakes_admin_notes_lock
  BEFORE UPDATE ON public.hard_disk_intakes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_enforce_hard_disk_intakes_admin_notes_lock();