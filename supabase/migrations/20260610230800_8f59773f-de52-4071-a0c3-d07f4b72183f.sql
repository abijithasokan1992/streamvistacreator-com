
CREATE TABLE public.checklist_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  checklist_key text NOT NULL,
  state text NOT NULL CHECK (state IN ('forced_complete','forced_incomplete')),
  note text,
  set_by uuid REFERENCES auth.users(id),
  set_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX checklist_overrides_scope_uniq
  ON public.checklist_overrides (workspace_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid), checklist_key);

CREATE INDEX checklist_overrides_ws_idx ON public.checklist_overrides(workspace_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_overrides TO authenticated;
GRANT ALL ON public.checklist_overrides TO service_role;

ALTER TABLE public.checklist_overrides ENABLE ROW LEVEL SECURITY;

-- Workspace members can READ overrides (so the UI reflects forced state for everyone).
CREATE POLICY "members read checklist overrides"
  ON public.checklist_overrides FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_workspace_member(workspace_id, auth.uid())
  );

-- Only admins (global admin OR workspace owner/admin OR super admin) can write.
CREATE POLICY "admins insert checklist overrides"
  ON public.checklist_overrides FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "admins update checklist overrides"
  ON public.checklist_overrides FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_workspace_admin(workspace_id, auth.uid())
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "admins delete checklist overrides"
  ON public.checklist_overrides FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE TRIGGER checklist_overrides_touch
  BEFORE UPDATE ON public.checklist_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime so all members see admin overrides instantly.
ALTER TABLE public.checklist_overrides REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_overrides;
