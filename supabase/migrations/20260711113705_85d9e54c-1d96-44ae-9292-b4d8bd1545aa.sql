
-- 1) members: workspace/org-scoped read via security-definer helper
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.organization_id = _org_id
      AND m.email IS NOT NULL
      AND lower(m.email) = lower(COALESCE((SELECT email FROM auth.users WHERE id = _user_id), ''))
  )
$$;

DROP POLICY IF EXISTS "Members can read their own record" ON public.members;
CREATE POLICY "Members read own or same-org records"
ON public.members FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR ((email IS NOT NULL) AND lower(email) = lower(COALESCE((auth.jwt() ->> 'email'), '')))
  OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
);

-- 2) onboarding_requests: submission-token read for anon submitters
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS submission_token uuid UNIQUE DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.get_onboarding_request_by_token(_token uuid)
RETURNS SETOF public.onboarding_requests
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.onboarding_requests WHERE submission_token = _token LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_onboarding_request_by_token(uuid) TO anon, authenticated;

-- 5) studio_assets: enforce owner_id = auth.uid() and workspace membership on INSERT
DROP POLICY IF EXISTS "Studio owners can insert their assets" ON public.studio_assets;
CREATE POLICY "Studio owners can insert their assets"
ON public.studio_assets FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND is_workspace_member(workspace_id, auth.uid())
);

-- studio_asset_files: enforce that file inserts/updates only apply to assets the
-- caller actually owns (owner_id = auth.uid()) or workspace-admins in that asset's workspace;
-- prevents spoofed folder ownership by clients supplying arbitrary asset_id.
DROP POLICY IF EXISTS "Members can manage asset files for their assets" ON public.studio_asset_files;
DROP POLICY IF EXISTS "Members can view asset files for their assets" ON public.studio_asset_files;

CREATE POLICY "Owners view asset files"
ON public.studio_asset_files FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.studio_assets a
  WHERE a.id = studio_asset_files.asset_id
    AND (a.owner_id = auth.uid()
         OR is_workspace_admin(a.workspace_id, auth.uid())
         OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Owners insert asset files"
ON public.studio_asset_files FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.studio_assets a
  WHERE a.id = studio_asset_files.asset_id
    AND (a.owner_id = auth.uid()
         OR is_workspace_admin(a.workspace_id, auth.uid()))
));

CREATE POLICY "Owners update asset files"
ON public.studio_asset_files FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.studio_assets a
  WHERE a.id = studio_asset_files.asset_id
    AND (a.owner_id = auth.uid()
         OR is_workspace_admin(a.workspace_id, auth.uid()))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.studio_assets a
  WHERE a.id = studio_asset_files.asset_id
    AND (a.owner_id = auth.uid()
         OR is_workspace_admin(a.workspace_id, auth.uid()))
));

CREATE POLICY "Owners delete asset files"
ON public.studio_asset_files FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.studio_assets a
  WHERE a.id = studio_asset_files.asset_id
    AND (a.owner_id = auth.uid()
         OR is_workspace_admin(a.workspace_id, auth.uid())
         OR has_role(auth.uid(), 'admin'::app_role))
));

-- 6) commercial_requests: enforce state_changed_by = auth.uid() on UPDATE
DROP POLICY IF EXISTS "Admin updates any commercial request" ON public.commercial_requests;
CREATE POLICY "Admin updates any commercial request"
ON public.commercial_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND (state_changed_by IS NULL OR state_changed_by = auth.uid())
);

DROP POLICY IF EXISTS "Owner updates awaiting_creator_review to decision" ON public.commercial_requests;
CREATE POLICY "Owner updates awaiting_creator_review to decision"
ON public.commercial_requests FOR UPDATE TO authenticated
USING ((owner_user_id = auth.uid()) AND (state = 'awaiting_creator_review'::commercial_request_state))
WITH CHECK (
  owner_user_id = auth.uid()
  AND state = ANY (ARRAY['approved_for_negotiation'::commercial_request_state,'rejected'::commercial_request_state])
  AND (state_changed_by IS NULL OR state_changed_by = auth.uid())
);

-- Harden trigger: force state_changed_by to auth.uid() on every state transition (defense-in-depth)
CREATE OR REPLACE FUNCTION public.tg_log_commercial_request_state()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, NULL, NEW.state, auth.uid(), 'created');
    NEW.state_changed_by := auth.uid();
    NEW.state_changed_at := now();
  ELSIF TG_OP = 'UPDATE' AND NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, OLD.state, NEW.state, auth.uid(), NEW.admin_notes);
    NEW.state_changed_at := now();
    NEW.state_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END $function$;
