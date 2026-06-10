
-- 1. Stop leaking referrer/email/commission data to referred users.
DROP POLICY IF EXISTS "Referred users see their own referral" ON public.referrals;

-- 2. Lock down secret tables (service role bypasses RLS; deny everyone else).
DROP POLICY IF EXISTS "Deny all on intro_invite_secrets" ON public.intro_invite_secrets;
CREATE POLICY "Deny all on intro_invite_secrets" ON public.intro_invite_secrets
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.intro_invite_secrets FROM anon, authenticated;
GRANT ALL ON public.intro_invite_secrets TO service_role;

DROP POLICY IF EXISTS "Deny all on review_link_secrets" ON public.review_link_secrets;
CREATE POLICY "Deny all on review_link_secrets" ON public.review_link_secrets
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.review_link_secrets FROM anon, authenticated;
GRANT ALL ON public.review_link_secrets TO service_role;

DROP POLICY IF EXISTS "Deny all on shared_file_secrets" ON public.shared_file_secrets;
CREATE POLICY "Deny all on shared_file_secrets" ON public.shared_file_secrets
  AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.shared_file_secrets FROM anon, authenticated;
GRANT ALL ON public.shared_file_secrets TO service_role;

-- 3. Let submitters read back their own onboarding requests.
DROP POLICY IF EXISTS "Submitters can view their own onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Submitters can view their own onboarding requests"
  ON public.onboarding_requests
  FOR SELECT TO authenticated
  USING (submitter_user_id IS NOT NULL AND submitter_user_id = auth.uid());

-- 4. Stop directory listing of the public `marketing` storage bucket.
-- Public GETs of specific files still work via /object/public/marketing/<path>.
DROP POLICY IF EXISTS "Public read marketing bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admins read marketing bucket" ON storage.objects;
CREATE POLICY "Admins read marketing bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'::public.app_role));
