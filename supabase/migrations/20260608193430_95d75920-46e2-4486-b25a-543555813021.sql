GRANT INSERT ON public.onboarding_requests TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.onboarding_requests TO authenticated;
GRANT ALL ON public.onboarding_requests TO service_role;

DROP POLICY IF EXISTS "Public can submit valid onboarding request" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Allow anon and authenticated to create onboarding requests" ON public.onboarding_requests;

CREATE POLICY "Allow anon and authenticated to create onboarding requests"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);