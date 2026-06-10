
-- intro_invites: hide token column from client roles
REVOKE SELECT (token) ON public.intro_invites FROM authenticated;
REVOKE SELECT (token) ON public.intro_invites FROM anon;

-- shared_files: hide password hash/salt from client roles (vault-share uses service_role)
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM authenticated;
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM anon;

-- premium_invitations: drop post-redemption invitee read (admin policy still applies)
DROP POLICY IF EXISTS "Invitee reads own" ON public.premium_invitations;
