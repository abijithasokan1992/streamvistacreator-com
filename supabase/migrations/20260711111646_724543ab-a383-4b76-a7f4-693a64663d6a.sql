
-- 1) onboarding_requests: allow submitter to read by matched business_email
CREATE POLICY "Submitters read own by email"
  ON public.onboarding_requests FOR SELECT TO authenticated
  USING (submitter_user_id = auth.uid()
         OR (business_email IS NOT NULL AND lower(business_email) = lower(coalesce(auth.jwt() ->> 'email',''))));
ALTER TABLE public.onboarding_requests FORCE ROW LEVEL SECURITY;

-- 2) dmca_requests: ensure admin-only reads, force RLS
ALTER TABLE public.dmca_requests FORCE ROW LEVEL SECURITY;

-- 3) workspace-scoped reads on productions, deliverables, asset_metadata, asset_versions, assets
CREATE POLICY "Members read productions"
  ON public.productions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         OR is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members read assets"
  ON public.assets FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role)
         OR is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Members read deliverables"
  ON public.deliverables FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.productions p
               WHERE p.id = deliverables.production_id
                 AND is_workspace_member(p.workspace_id, auth.uid()))
    OR EXISTS (SELECT 1 FROM public.projects pr
               WHERE pr.id = deliverables.project_id
                 AND is_workspace_member(pr.workspace_id, auth.uid()))
  );

CREATE POLICY "Members read asset_metadata"
  ON public.asset_metadata FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.assets a
               WHERE a.id = asset_metadata.asset_id
                 AND is_workspace_member(a.workspace_id, auth.uid()))
  );

CREATE POLICY "Members read asset_versions"
  ON public.asset_versions FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.assets a
               WHERE a.id = asset_versions.asset_id
                 AND is_workspace_member(a.workspace_id, auth.uid()))
  );

ALTER TABLE public.productions   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asset_metadata FORCE ROW LEVEL SECURITY;
ALTER TABLE public.asset_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assets FORCE ROW LEVEL SECURITY;

-- 4) branding_settings: admin-only full read (already); expose public-safe fields via SECURITY DEFINER RPC only
ALTER TABLE public.branding_settings FORCE ROW LEVEL SECURITY;
REVOKE SELECT ON public.branding_settings FROM anon, authenticated;
-- get_active_branding() is the sanctioned public read path (already returns only public-safe columns).

-- 5) premium_invitations: allow invitee self-read by token or invitee_email
CREATE OR REPLACE FUNCTION public.verify_premium_invitation(_token text)
RETURNS TABLE(
  id uuid, invitee_name text, invitee_email text, storage_tb int,
  discount_percent numeric, validity_days int, is_free boolean,
  status text, expires_at timestamptz, account_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, invitee_name, invitee_email, storage_tb, discount_percent,
         validity_days, is_free, status, expires_at, account_type
  FROM public.premium_invitations
  WHERE token = _token
    AND status IN ('pending','sent')
    AND expires_at > now()
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.verify_premium_invitation(text) TO anon, authenticated;

CREATE POLICY "Invitee reads own invitation"
  ON public.premium_invitations FOR SELECT TO authenticated
  USING (
    redeemed_by = auth.uid()
    OR (invitee_email IS NOT NULL
        AND lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email','')))
  );
ALTER TABLE public.premium_invitations FORCE ROW LEVEL SECURITY;

-- 6) checklist_overrides: SELECT already scoped to workspace members; ensure realtime respects RLS via forced RLS
ALTER TABLE public.checklist_overrides FORCE ROW LEVEL SECURITY;

-- 7) intro_invites: inviter-scoped read already exists; drop the redundant admin duplicate and force RLS
DROP POLICY IF EXISTS "Admins can read all rows" ON public.intro_invites;
ALTER TABLE public.intro_invites FORCE ROW LEVEL SECURITY;
