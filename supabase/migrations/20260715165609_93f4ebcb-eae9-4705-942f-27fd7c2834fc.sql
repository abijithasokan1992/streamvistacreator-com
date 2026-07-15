
-- 1) content_titles: drop any legacy overly-permissive insert policy if it still exists
DROP POLICY IF EXISTS "Allow creator inserts" ON public.content_titles;

-- 2) distribution_partners: keep active-read policy but revoke sensitive columns from authenticated
REVOKE SELECT ON public.distribution_partners FROM authenticated;
GRANT SELECT (
  id, slug, name, protocol, description, is_active,
  requires_aspera, requires_signiant,
  default_package_type, supported_package_types, delivery_window,
  logo_url, created_at, updated_at
) ON public.distribution_partners TO authenticated;
-- service_role & admin (via policy) retain full access; contact_email + config hidden from creators.

-- 3) onboarding_requests: server-side pricing enforcement
CREATE OR REPLACE FUNCTION public.enforce_onboarding_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle text := lower(coalesce(NEW.selected_cycle, ''));
  v_base numeric;
  v_promo text := NEW.promo_code;
BEGIN
  -- Compute canonical base price from cycle
  v_base := CASE v_cycle
    WHEN 'free'    THEN 0
    WHEN 'creator' THEN 650
    WHEN 'topup'   THEN 650
    ELSE NULL
  END;

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Invalid selected_cycle: %', NEW.selected_cycle
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.base_price := v_base;

  -- Server-side promo resolution
  IF v_promo IS NULL THEN
    NEW.final_price := v_base;
    IF NEW.payment_status IS NULL OR NEW.payment_status NOT IN ('pending','free') THEN
      NEW.payment_status := CASE WHEN v_base = 0 THEN 'free' ELSE 'pending' END;
    END IF;
  ELSIF v_promo = 'INDUSTRY100' THEN
    NEW.final_price := 0;
    NEW.payment_status := 'free';
  ELSE
    RAISE EXCEPTION 'Unknown or unsupported promo_code: %', v_promo
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_onboarding_pricing() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_onboarding_pricing ON public.onboarding_requests;
CREATE TRIGGER trg_enforce_onboarding_pricing
BEFORE INSERT OR UPDATE OF selected_cycle, promo_code, base_price, final_price, payment_status
ON public.onboarding_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_onboarding_pricing();

-- 4) Ensure RLS is enabled on realtime-published tables (idempotent)
ALTER TABLE public.agent_events               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_overrides        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recent_uploads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_topups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_removal_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_storage_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_storage_usage    ENABLE ROW LEVEL SECURITY;
