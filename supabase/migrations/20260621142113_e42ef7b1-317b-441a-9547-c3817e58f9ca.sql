DROP POLICY IF EXISTS ri_invitee_read_own ON public.role_invitations;
CREATE POLICY ri_invitee_read_own ON public.role_invitations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = lower(role_invitations.email)
  )
);