
-- Defense-in-depth: explicit RESTRICTIVE policies forbidding non-admin role writes on user_roles.
-- The existing permissive admin ALL policy + RLS default-deny already block self-grants,
-- but RESTRICTIVE policies AND on top of every other policy, making the guarantee explicit.

DROP POLICY IF EXISTS "Only admins may insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins may delete roles" ON public.user_roles;

CREATE POLICY "Only admins may insert roles"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins may update roles"
  ON public.user_roles AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins may delete roles"
  ON public.user_roles AS RESTRICTIVE
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Belt-and-suspenders on intro_invites: explicit RESTRICTIVE policy preventing
-- inviters (or anyone non-admin) from ever SELECTing invitee email/token columns.
-- (No permissive SELECT policy currently grants inviters access; this guarantees
-- none can be added accidentally later without also satisfying the admin check.)
DROP POLICY IF EXISTS "Only admins may read intro invite rows" ON public.intro_invites;
CREATE POLICY "Only admins may read intro invite rows"
  ON public.intro_invites AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
