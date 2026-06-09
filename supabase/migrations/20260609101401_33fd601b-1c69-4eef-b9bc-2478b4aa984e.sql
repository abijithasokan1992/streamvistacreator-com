DROP POLICY IF EXISTS "Allow anonymous and authenticated users to submit onboarding re" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Allow anonymous and authenticated users to submit onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Public can submit onboarding requests"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(client_name)) BETWEEN 1 AND 200
  AND length(btrim(professional_role)) BETWEEN 1 AND 200
  AND base_price >= 0
  AND final_price >= 0
  AND onboarding_status = 'pending'
  AND payment_status IN ('pending','unpaid')
);