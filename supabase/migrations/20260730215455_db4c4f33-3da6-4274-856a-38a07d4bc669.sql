
-- Verified-email helper: returns the signed-in user's email ONLY when confirmed.
CREATE OR REPLACE FUNCTION public.current_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email::text)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
    AND u.email IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_verified_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_verified_email() TO authenticated, service_role;

-- 1. legacy_film_imports
DROP POLICY IF EXISTS "own email can view legacy imports" ON public.legacy_film_imports;
CREATE POLICY "own email can view legacy imports"
ON public.legacy_film_imports
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
  OR (
    uploader_email IS NOT NULL
    AND public.current_verified_email() IS NOT NULL
    AND lower(uploader_email) = public.current_verified_email()
  )
);

-- 2. members (+ is_org_member)
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    JOIN auth.users u ON u.id = _user_id
    WHERE m.organization_id = _org_id
      AND m.email IS NOT NULL
      AND u.email IS NOT NULL
      AND u.email_confirmed_at IS NOT NULL
      AND lower(m.email) = lower(u.email::text)
  )
$$;

DROP POLICY IF EXISTS "Members read own or same-org records" ON public.members;
CREATE POLICY "Members read own or same-org records"
ON public.members
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    email IS NOT NULL
    AND public.current_verified_email() IS NOT NULL
    AND lower(email) = public.current_verified_email()
  )
  OR (organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid()))
);

-- 3. onboarding_requests
DROP POLICY IF EXISTS "Submitters read own onboarding request" ON public.onboarding_requests;
CREATE POLICY "Submitters read own onboarding request"
ON public.onboarding_requests
FOR SELECT
TO authenticated
USING (
  submitter_user_id = auth.uid()
  OR (
    submitter_user_id IS NULL
    AND business_email IS NOT NULL
    AND public.current_verified_email() IS NOT NULL
    AND lower(business_email) = public.current_verified_email()
  )
);

-- 4. premium_invitations
DROP POLICY IF EXISTS "Invitee reads own invitation" ON public.premium_invitations;
CREATE POLICY "Invitee reads own invitation"
ON public.premium_invitations
FOR SELECT
TO authenticated
USING (
  redeemed_by = auth.uid()
  OR (
    invitee_email IS NOT NULL
    AND public.current_verified_email() IS NOT NULL
    AND lower(invitee_email) = public.current_verified_email()
  )
);

-- 5. role_invitations
DROP POLICY IF EXISTS "ri_invitee_read_own" ON public.role_invitations;
CREATE POLICY "ri_invitee_read_own"
ON public.role_invitations
FOR SELECT
TO authenticated
USING (
  email IS NOT NULL
  AND public.current_verified_email() IS NOT NULL
  AND lower(email) = public.current_verified_email()
);
