REVOKE ALL ON public.onboarding_requests FROM anon;
GRANT INSERT ON public.onboarding_requests TO anon;
GRANT SELECT (id) ON public.onboarding_requests TO anon;
GRANT INSERT ON public.onboarding_requests TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.onboarding_requests TO authenticated;
GRANT ALL ON public.onboarding_requests TO service_role;

DROP POLICY IF EXISTS "Public can submit valid onboarding request" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Allow anon and authenticated to create onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Allow anonymous and authenticated users to submit onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Visitors can read onboarding request identifiers" ON public.onboarding_requests;

CREATE POLICY "Allow anonymous and authenticated users to submit onboarding requests"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Visitors can read onboarding request identifiers"
ON public.onboarding_requests
FOR SELECT
TO anon
USING (true);