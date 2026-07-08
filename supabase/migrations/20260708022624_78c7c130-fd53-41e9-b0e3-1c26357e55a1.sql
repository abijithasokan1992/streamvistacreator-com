
-- Drop the old policy that joins auth.users (source of 42501)
DROP POLICY IF EXISTS ri_invitee_read_own ON public.role_invitations;

-- Recreate using the JWT-provided email. No auth.users access required.
-- auth.jwt() is exposed to the authenticated role by Supabase and is the
-- documented, safe way to reference the caller's email in RLS.
CREATE POLICY ri_invitee_read_own
  ON public.role_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
