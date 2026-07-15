
DO $$ BEGIN
  CREATE TYPE public.managed_ops_action AS ENUM (
    'upload','edit_metadata','create_version','qc','artwork','subtitle',
    'rights','package','deliver','archive','report','approve'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_workspace_mode (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'managed' CHECK (mode IN ('managed','self_service')),
  decided_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_workspace_mode TO authenticated;
GRANT ALL ON public.user_workspace_mode TO service_role;
ALTER TABLE public.user_workspace_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uwm select" ON public.user_workspace_mode
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'managed_ops_lead')
  );
CREATE POLICY "uwm insert self" ON public.user_workspace_mode
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "uwm update self" ON public.user_workspace_mode
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.managed_projects (
  content_title_id uuid PRIMARY KEY REFERENCES public.content_titles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  assigned_team text,
  assigned_operator uuid REFERENCES auth.users(id),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date date,
  status text NOT NULL DEFAULT 'intake' CHECK (status IN ('intake','in_progress','qc','packaging','delivery','completed','on_hold')),
  progress_pct int NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.managed_projects TO authenticated;
GRANT INSERT, UPDATE ON public.managed_projects TO authenticated;
GRANT ALL ON public.managed_projects TO service_role;
ALTER TABLE public.managed_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp read" ON public.managed_projects FOR SELECT TO authenticated USING (
  owner_id = auth.uid()
  OR assigned_operator = auth.uid()
  OR public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'managed_ops_operator')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
);
CREATE POLICY "mp insert owner" ON public.managed_projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "mp update owner_or_lead" ON public.managed_projects FOR UPDATE TO authenticated USING (
  owner_id = auth.uid()
  OR public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
);

CREATE TABLE IF NOT EXISTS public.managed_project_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action public.managed_ops_action NOT NULL,
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (content_title_id, operator_id, action)
);
GRANT SELECT ON public.managed_project_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.managed_project_permissions TO authenticated;
GRANT ALL ON public.managed_project_permissions TO service_role;
ALTER TABLE public.managed_project_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpp read" ON public.managed_project_permissions FOR SELECT TO authenticated USING (
  operator_id = auth.uid()
  OR public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = content_title_id AND ct.owner_user_id = auth.uid())
);
CREATE POLICY "mpp manage" ON public.managed_project_permissions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
) WITH CHECK (
  public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
);

CREATE TABLE IF NOT EXISTS public.managed_ops_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.managed_ops_audit TO authenticated;
GRANT ALL ON public.managed_ops_audit TO service_role;
ALTER TABLE public.managed_ops_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moa read" ON public.managed_ops_audit FOR SELECT TO authenticated USING (
  actor_id = auth.uid()
  OR public.has_role(auth.uid(),'managed_ops_lead')
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = content_title_id AND ct.owner_user_id = auth.uid())
);
CREATE POLICY "moa insert self" ON public.managed_ops_audit FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.emergency_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  reason text NOT NULL CHECK (length(reason) >= 10),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > granted_at)
);
GRANT SELECT, INSERT, UPDATE ON public.emergency_access_grants TO authenticated;
GRANT ALL ON public.emergency_access_grants TO service_role;
ALTER TABLE public.emergency_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eag read" ON public.emergency_access_grants FOR SELECT TO authenticated USING (
  admin_id = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'super_admin')
  OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = content_title_id AND ct.owner_user_id = auth.uid())
);
CREATE POLICY "eag create by admin" ON public.emergency_access_grants FOR INSERT TO authenticated WITH CHECK (
  admin_id = auth.uid()
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
);
CREATE POLICY "eag revoke by admin" ON public.emergency_access_grants FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')
);

CREATE OR REPLACE FUNCTION public.is_managed_ops_lead(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'managed_ops_lead')
      OR public.has_role(_user_id,'admin')
      OR public.has_role(_user_id,'super_admin');
$$;
REVOKE ALL ON FUNCTION public.is_managed_ops_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_managed_ops_lead(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_operate_on_project(
  _user_id uuid, _content_title_id uuid, _action public.managed_ops_action
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (public.is_managed_ops_lead(_user_id)
      AND EXISTS (SELECT 1 FROM public.managed_projects mp WHERE mp.content_title_id = _content_title_id AND mp.enabled))
    OR EXISTS (
      SELECT 1
      FROM public.managed_project_permissions p
      JOIN public.managed_projects mp ON mp.content_title_id = p.content_title_id AND mp.enabled
      WHERE p.content_title_id = _content_title_id
        AND p.operator_id = _user_id
        AND p.action = _action
        AND p.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.emergency_access_grants g
      WHERE g.content_title_id = _content_title_id
        AND g.admin_id = _user_id
        AND g.revoked_at IS NULL
        AND g.expires_at > now()
    );
$$;
REVOKE ALL ON FUNCTION public.can_operate_on_project(uuid, uuid, public.managed_ops_action) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_operate_on_project(uuid, uuid, public.managed_ops_action) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_managed_ops_audit_content_titles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid; v_uid uuid := auth.uid();
BEGIN
  v_owner := COALESCE(NEW.owner_user_id, OLD.owner_user_id);
  IF v_uid IS NULL OR v_uid = v_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  INSERT INTO public.managed_ops_audit(content_title_id, actor_id, actor_role, action, target, metadata)
  VALUES (
    COALESCE(NEW.id, OLD.id), v_uid,
    CASE WHEN public.has_role(v_uid,'managed_ops_lead') THEN 'managed_ops_lead'
         WHEN public.has_role(v_uid,'managed_ops_operator') THEN 'managed_ops_operator'
         WHEN public.has_role(v_uid,'admin') THEN 'admin'
         WHEN public.has_role(v_uid,'super_admin') THEN 'super_admin'
         ELSE 'other' END,
    TG_OP, 'content_titles',
    jsonb_build_object('status', COALESCE(NEW.status::text, OLD.status::text))
  );
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_managed_ops_audit_content_titles ON public.content_titles;
CREATE TRIGGER trg_managed_ops_audit_content_titles
AFTER INSERT OR UPDATE OR DELETE ON public.content_titles
FOR EACH ROW EXECUTE FUNCTION public.trg_managed_ops_audit_content_titles();

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_uwm_touch ON public.user_workspace_mode;
CREATE TRIGGER trg_uwm_touch BEFORE UPDATE ON public.user_workspace_mode
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_mp_touch ON public.managed_projects;
CREATE TRIGGER trg_mp_touch BEFORE UPDATE ON public.managed_projects
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
