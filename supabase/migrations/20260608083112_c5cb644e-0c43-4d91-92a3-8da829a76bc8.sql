
DROP POLICY IF EXISTS "Public can submit valid onboarding request" ON public.onboarding_requests;

CREATE POLICY "Public can submit valid onboarding request"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(client_name)) BETWEEN 1 AND 200
  AND length(btrim(professional_role)) BETWEEN 1 AND 100
  AND (
    (contact_phone IS NOT NULL AND length(btrim(contact_phone)) BETWEEN 6 AND 30)
    OR (business_email IS NOT NULL AND business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  )
  AND selected_cycle = ANY (ARRAY['free','monthly','quarterly','yearly'])
  AND base_price >= 0
  AND final_price >= 0
  AND onboarding_status = 'pending'
  AND plan_type = ANY (ARRAY['standard','mfi_limited','free'])
);
