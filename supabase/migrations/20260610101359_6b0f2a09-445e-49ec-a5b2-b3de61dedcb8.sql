
-- intro_invites: remove broad ALL policy, split into write-only for inviter + admin read
DROP POLICY IF EXISTS "Users manage their own intro invites" ON public.intro_invites;

CREATE POLICY "Inviters can insert their intro invites"
ON public.intro_invites
FOR INSERT
TO authenticated
WITH CHECK (inviter_user_id = auth.uid());

CREATE POLICY "Inviters can update their intro invites"
ON public.intro_invites
FOR UPDATE
TO authenticated
USING (inviter_user_id = auth.uid())
WITH CHECK (inviter_user_id = auth.uid());

CREATE POLICY "Inviters can delete their intro invites"
ON public.intro_invites
FOR DELETE
TO authenticated
USING (inviter_user_id = auth.uid());

CREATE POLICY "Admins can read intro invites"
ON public.intro_invites
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- recent_uploads: restrict SELECT to uploader + workspace admin/owner only
DROP POLICY IF EXISTS "Workspace members can view recent uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Members can view recent uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Workspace members read recent uploads" ON public.recent_uploads;

CREATE POLICY "Uploader and workspace admins can view recent uploads"
ON public.recent_uploads
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_workspace_admin(workspace_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
