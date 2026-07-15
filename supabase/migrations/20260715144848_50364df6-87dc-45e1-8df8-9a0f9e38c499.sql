
-- =========================================================================
-- Issue 1: Server-authoritative pricing on onboarding_requests
-- =========================================================================

-- Base plan prices (pre-GST, INR) mirrored from supabase/functions/_shared/pricing.ts
CREATE OR REPLACE FUNCTION public.onboarding_requests_enforce_server_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base numeric;
  v_code text;
  v_allowed_codes text[] := ARRAY['INDUSTRY100'];
BEGIN
  -- Determine authoritative base price from selected_cycle. Any other cycle
  -- values (e.g. 'free') get a zero base and rely on downstream logic.
  v_base := CASE lower(coalesce(NEW.selected_cycle, ''))
    WHEN 'creator' THEN 650
    WHEN 'topup'   THEN 650
    ELSE 0
  END;

  -- Overwrite client-supplied price fields with server values.
  NEW.base_price := v_base;
  NEW.final_price := v_base;  -- final price is finalized by the payment edge function (service_role)

  -- Sanitize promo_code: only allow whitelisted codes, otherwise NULL.
  v_code := upper(nullif(btrim(coalesce(NEW.promo_code, '')), ''));
  IF v_code IS NULL OR NOT (v_code = ANY (v_allowed_codes)) THEN
    NEW.promo_code := NULL;
  ELSE
    NEW.promo_code := v_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_requests_enforce_server_pricing ON public.onboarding_requests;
CREATE TRIGGER trg_onboarding_requests_enforce_server_pricing
BEFORE INSERT ON public.onboarding_requests
FOR EACH ROW
-- Skip trigger for service_role (edge functions / admin backfills). RLS-bypassing
-- service_role callers are trusted; anon/authenticated always run the trigger.
WHEN (current_setting('request.jwt.claims', true)::jsonb->>'role' IS DISTINCT FROM 'service_role')
EXECUTE FUNCTION public.onboarding_requests_enforce_server_pricing();

-- Tighten INSERT policies: forbid client-set price/promo fields (they must be NULL/0
-- at policy-check time; the BEFORE INSERT trigger has already normalized them, but
-- the WITH CHECK still guards against a future trigger-bypass).
DROP POLICY IF EXISTS onboarding_requests_anon_insert ON public.onboarding_requests;
CREATE POLICY onboarding_requests_anon_insert
ON public.onboarding_requests
FOR INSERT
TO anon
WITH CHECK (
  submitter_user_id IS NULL
  AND onboarding_status = 'pending'
  AND payment_status = 'pending'
  AND access_code IS NULL
  AND base_price = CASE lower(coalesce(selected_cycle, ''))
        WHEN 'creator' THEN 650
        WHEN 'topup'   THEN 650
        ELSE 0 END
  AND final_price = base_price
  AND (promo_code IS NULL OR promo_code IN ('INDUSTRY100'))
);

DROP POLICY IF EXISTS onboarding_requests_auth_insert ON public.onboarding_requests;
CREATE POLICY onboarding_requests_auth_insert
ON public.onboarding_requests
FOR INSERT
TO authenticated
WITH CHECK (
  submitter_user_id = auth.uid()
  AND onboarding_status = 'pending'
  AND payment_status = 'pending'
  AND access_code IS NULL
  AND base_price = CASE lower(coalesce(selected_cycle, ''))
        WHEN 'creator' THEN 650
        WHEN 'topup'   THEN 650
        ELSE 0 END
  AND final_price = base_price
  AND (promo_code IS NULL OR promo_code IN ('INDUSTRY100'))
);

-- =========================================================================
-- Issue 2: title_removal_policy readable only by admins
-- =========================================================================

DROP POLICY IF EXISTS policy_read_all_auth ON public.title_removal_policy;

CREATE POLICY title_removal_policy_admin_read
ON public.title_removal_policy
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
