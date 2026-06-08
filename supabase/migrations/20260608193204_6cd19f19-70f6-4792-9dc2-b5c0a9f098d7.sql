
REVOKE SELECT ON public.intro_invites FROM authenticated;
GRANT SELECT (
  id, inviter_user_id, first_name, last_name, email, status, rate,
  expires_at, accepted_user_id, accepted_at, created_at, updated_at
) ON public.intro_invites TO authenticated;
