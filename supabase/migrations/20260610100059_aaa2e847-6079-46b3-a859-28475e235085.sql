
-- 1. Workspace role enum
DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);

DROP TRIGGER IF EXISTS trg_workspaces_touch ON public.workspaces;
CREATE TRIGGER trg_workspaces_touch BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Workspace members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- 4. Security-definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner','admin','editor')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND role IN ('owner','admin')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid,uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid,uuid) TO authenticated;

-- 5. RLS policies on workspaces
DROP POLICY IF EXISTS "Members read workspaces" ON public.workspaces;
CREATE POLICY "Members read workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(id, auth.uid()) OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Owners insert workspaces" ON public.workspaces;
CREATE POLICY "Owners insert workspaces" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspace admins update" ON public.workspaces;
CREATE POLICY "Workspace admins update" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_workspace_admin(id, auth.uid()) OR has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Owners delete workspaces" ON public.workspaces;
CREATE POLICY "Owners delete workspaces" ON public.workspaces
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'admin'));

-- 6. RLS policies on workspace_members
DROP POLICY IF EXISTS "Members read membership" ON public.workspace_members;
CREATE POLICY "Members read membership" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_workspace_member(workspace_id, auth.uid())
    OR has_role(auth.uid(),'admin')
  );

DROP POLICY IF EXISTS "Admins manage membership" ON public.workspace_members;
CREATE POLICY "Admins manage membership" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

-- 7. Trigger: when a workspace is created, auto-insert the owner as 'owner' member
CREATE OR REPLACE FUNCTION public.workspaces_add_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_workspaces_add_owner ON public.workspaces;
CREATE TRIGGER trg_workspaces_add_owner AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.workspaces_add_owner_member();

-- 8. Trigger: auto-create a personal workspace on new sign-up
CREATE OR REPLACE FUNCTION public.create_personal_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ws_name text;
BEGIN
  ws_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    split_part(NEW.email,'@',1),
    'My Workspace'
  ) || '''s Workspace';
  INSERT INTO public.workspaces (name, owner_id) VALUES (ws_name, NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_create_personal_workspace ON auth.users;
CREATE TRIGGER trg_create_personal_workspace AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_personal_workspace();

-- 9. Backfill: ensure every existing project/upload owner has a personal workspace
INSERT INTO public.workspaces (name, owner_id)
SELECT 'My Workspace', u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.owner_id = u.id);

-- 10. Migrate projects: add workspace_id, backfill, drop production_banner column and enum
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.projects p
SET workspace_id = w.id
FROM public.workspaces w
WHERE p.workspace_id IS NULL AND w.owner_id = p.user_id
  AND w.id = (SELECT id FROM public.workspaces WHERE owner_id = p.user_id ORDER BY created_at ASC LIMIT 1);

DROP INDEX IF EXISTS public.idx_projects_production_banner;
ALTER TABLE public.projects DROP COLUMN IF EXISTS production_banner;
DROP TYPE IF EXISTS public.production_house_type;

ALTER TABLE public.projects ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);

-- 11. Migrate recent_uploads: add workspace_id and backfill
ALTER TABLE public.recent_uploads ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.recent_uploads ru
SET workspace_id = (SELECT id FROM public.workspaces WHERE owner_id = ru.user_id ORDER BY created_at ASC LIMIT 1)
WHERE ru.workspace_id IS NULL;

ALTER TABLE public.recent_uploads ALTER COLUMN workspace_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recent_uploads_workspace ON public.recent_uploads(workspace_id, created_at DESC);

-- 12. Rewrite projects RLS to be workspace-scoped
DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins manage all projects" ON public.projects;

CREATE POLICY "Workspace members read projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Workspace writers insert projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Workspace writers update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Workspace admins delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

-- 13. Rewrite recent_uploads RLS to be workspace-scoped
DROP POLICY IF EXISTS "Users view own uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Users insert own uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Users update own uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Users delete own uploads" ON public.recent_uploads;

CREATE POLICY "Workspace members read uploads" ON public.recent_uploads
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Workspace writers insert uploads" ON public.recent_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  );

CREATE POLICY "Workspace writers update uploads" ON public.recent_uploads
  FOR UPDATE TO authenticated
  USING (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "Workspace writers delete uploads" ON public.recent_uploads
  FOR DELETE TO authenticated
  USING (public.can_write_workspace(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'));
