-- Make admin-only access explicit and unambiguous on members table
-- by adding a RESTRICTIVE policy that denies access to anyone who is not an admin.
CREATE POLICY "Deny non-admin access to members"
  ON public.members
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
