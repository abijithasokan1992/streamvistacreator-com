
DROP POLICY IF EXISTS onboarding_requests_anon_insert ON public.onboarding_requests;
DROP POLICY IF EXISTS onboarding_requests_auth_insert ON public.onboarding_requests;

CREATE POLICY onboarding_requests_anon_insert ON public.onboarding_requests
FOR INSERT TO anon
WITH CHECK (
  submitter_user_id IS NULL
  AND onboarding_status = 'pending'
  AND payment_status IN ('pending','free')
  AND access_code IS NULL
  AND lower(COALESCE(selected_cycle,'')) IN ('free','creator','topup')
  AND base_price = (CASE lower(selected_cycle)
      WHEN 'free' THEN 0
      WHEN 'creator' THEN 650
      WHEN 'topup' THEN 650
    END)::numeric
  AND final_price = base_price
  AND (promo_code IS NULL OR promo_code = 'INDUSTRY100')
);

CREATE POLICY onboarding_requests_auth_insert ON public.onboarding_requests
FOR INSERT TO authenticated
WITH CHECK (
  submitter_user_id = auth.uid()
  AND onboarding_status = 'pending'
  AND payment_status IN ('pending','free')
  AND access_code IS NULL
  AND lower(COALESCE(selected_cycle,'')) IN ('free','creator','topup')
  AND base_price = (CASE lower(selected_cycle)
      WHEN 'free' THEN 0
      WHEN 'creator' THEN 650
      WHEN 'topup' THEN 650
    END)::numeric
  AND final_price = base_price
  AND (promo_code IS NULL OR promo_code = 'INDUSTRY100')
);
