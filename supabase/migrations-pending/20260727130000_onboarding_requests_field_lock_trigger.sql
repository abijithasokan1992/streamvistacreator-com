-- SECURITY FIX (QUARANTINED — do NOT apply without explicit approval)
--
-- Findings addressed:
--   1. PRICE_MANIPULATION / onboarding_requests_ineffective_update_check
--   2. MISSING_RLS_PROTECTION / hard_disk_intakes_ineffective_admin_notes_check
--
-- Both existing RLS policies attempt to lock privileged columns via
-- correlated self-subqueries (SELECT o.<col> FROM <table> o WHERE o.id = <table>.id).
-- In Postgres RLS these subqueries observe the already-updated row at WITH CHECK
-- time, so every comparison degenerates to NEW = NEW and never blocks a change.
--
-- Fix: install BEFORE UPDATE triggers that compare OLD vs NEW, mirroring the
-- pattern already used successfully for billing_orders.
--
-- No app behavior change:
--   * onboarding_requests privileged fields are only ever mutated by the
--     Razorpay webhook and admin review RPCs, both of which run as service_role
--     (which bypasses RLS and this trigger via the current_setting check).
--   * hard_disk_intakes.admin_notes is only ever mutated by admin consoles.
--
-- Bypass scope is intentionally narrow: service_role, admin, super_admin only.
-- Not granted to: creator, studio, buyer, founder, platform_owner (none of
-- those roles have a verified server-side workflow requiring bypass here).

-- =====================================================================
-- 1. onboarding_requests owner field-lock
-- =====================================================================
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

  -- Column set derived from live schema inspection of public.onboarding_requests.
  -- razorpay_signature is intentionally NOT listed — column does not exist on
  -- this table. If it is added later, extend this trigger in the same migration.
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

-- =====================================================================
-- 2. hard_disk_intakes admin_notes lock
-- =====================================================================
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

  -- admin_notes is the only admin-authored field on this table. status is
  -- already RLS-locked to 'submitted' via the existing owner-update policy.
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

-- =====================================================================
-- ROLLBACK (manual — run to undo):
--   DROP TRIGGER IF EXISTS trg_enforce_onboarding_owner_field_lock ON public.onboarding_requests;
--   DROP FUNCTION IF EXISTS public.trg_enforce_onboarding_owner_field_lock();
--   DROP TRIGGER IF EXISTS trg_enforce_hard_disk_intakes_admin_notes_lock ON public.hard_disk_intakes;
--   DROP FUNCTION IF EXISTS public.trg_enforce_hard_disk_intakes_admin_notes_lock();
-- =====================================================================
