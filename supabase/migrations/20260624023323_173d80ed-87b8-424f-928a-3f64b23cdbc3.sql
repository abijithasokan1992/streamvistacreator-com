-- Security lockdown: remove the legacy "first user becomes admin" bootstrap path
-- from anything reachable by an authenticated client. The function stays in the
-- database for break-glass use via service_role only.
REVOKE EXECUTE ON FUNCTION public.claim_admin_if_none() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO service_role;

-- Defence in depth: a hardened trigger that rejects any client-driven insert
-- into user_roles for invite-only roles. Admin-driven inserts still pass
-- because has_role(auth.uid(),'admin') is true; service_role bypasses RLS
-- entirely so backend automations are unaffected.
CREATE OR REPLACE FUNCTION public.enforce_invite_only_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('admin','super_admin','qc_reviewer','legal_reviewer',
                  'localization_partner','distributor')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin')
  THEN
    RAISE EXCEPTION 'Invite-only roles cannot be self-assigned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_invite_only_roles_trg ON public.user_roles;
CREATE TRIGGER enforce_invite_only_roles_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_only_roles();