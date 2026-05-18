DROP POLICY "Anyone can submit onboarding request" ON public.onboarding_requests;

CREATE POLICY "Public can submit valid onboarding request"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(client_name)) BETWEEN 1 AND 200
  AND length(trim(professional_role)) BETWEEN 1 AND 100
  AND length(trim(contact_phone)) BETWEEN 6 AND 30
  AND selected_cycle IN ('monthly','quarterly','yearly')
  AND base_price >= 0
  AND final_price >= 0
  AND onboarding_status = 'pending'
);