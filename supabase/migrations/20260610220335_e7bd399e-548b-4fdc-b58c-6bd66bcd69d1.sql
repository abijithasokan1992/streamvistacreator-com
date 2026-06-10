-- 1. Onboarding Requests: strict submitter-only SELECT
DROP POLICY IF EXISTS "Submitters can view their own onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Submitters can view their own onboarding requests"
  ON public.onboarding_requests
  FOR SELECT
  TO authenticated
  USING (submitter_user_id = auth.uid());

-- Block anon from ever reading onboarding rows (RESTRICTIVE)
DROP POLICY IF EXISTS "Block anon SELECT on onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Block anon SELECT on onboarding requests"
  ON public.onboarding_requests
  AS RESTRICTIVE
  FOR SELECT
  TO anon
  USING (false);

-- 2. Intro Invites: strict inviter-only SELECT
DROP POLICY IF EXISTS "Inviters can read their intro invites" ON public.intro_invites;
CREATE POLICY "Inviters can read their intro invites"
  ON public.intro_invites
  FOR SELECT
  TO authenticated
  USING (inviter_user_id = auth.uid());

-- 3. Vault Storage: Admin full read access
DROP POLICY IF EXISTS "Admins read vault" ON storage.objects;
CREATE POLICY "Admins read vault"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'vault'::text AND has_role(auth.uid(), 'admin'::app_role));