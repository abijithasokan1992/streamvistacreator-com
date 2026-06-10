
-- 1. Enum of allowed banners
DO $$ BEGIN
  CREATE TYPE public.production_banner AS ENUM ('Crayons Pictures', 'Abhijith Asokan Productions');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tag workspaces + asset-bearing tables with the banner
ALTER TABLE public.workspaces       ADD COLUMN IF NOT EXISTS production_banner public.production_banner;
ALTER TABLE public.recent_uploads   ADD COLUMN IF NOT EXISTS production_banner public.production_banner;
ALTER TABLE public.upload_sessions  ADD COLUMN IF NOT EXISTS production_banner public.production_banner;
ALTER TABLE public.projects         ADD COLUMN IF NOT EXISTS production_banner public.production_banner;

CREATE INDEX IF NOT EXISTS idx_recent_uploads_banner  ON public.recent_uploads(production_banner);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_banner ON public.upload_sessions(production_banner);
CREATE INDEX IF NOT EXISTS idx_projects_banner        ON public.projects(production_banner);
CREATE INDEX IF NOT EXISTS idx_workspaces_banner      ON public.workspaces(production_banner);

-- 3. Super-admin / God-mode predicate
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = _user_id
          AND lower(email) = 'abijithasokan@crayonspictures.com'
      )
    );
$$;

-- 4. Banner-membership predicate used by the studio-isolation policies
CREATE OR REPLACE FUNCTION public.user_in_banner(_user_id uuid, _banner public.production_banner)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _banner IS NULL OR EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = _user_id
      AND w.production_banner = _banner
  );
$$;

-- 5. Routing trigger: auto-stamp banner from workspace, reject mismatches
CREATE OR REPLACE FUNCTION public.route_studio_asset()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  derived public.production_banner;
BEGIN
  IF NEW.workspace_id IS NOT NULL THEN
    SELECT production_banner INTO derived
    FROM public.workspaces
    WHERE id = NEW.workspace_id;
  END IF;

  IF NEW.production_banner IS NULL THEN
    NEW.production_banner := derived;
  ELSIF derived IS NOT NULL AND NEW.production_banner <> derived THEN
    RAISE EXCEPTION
      'production_banner % does not match workspace banner %',
      NEW.production_banner, derived
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_studio_asset_recent_uploads ON public.recent_uploads;
CREATE TRIGGER trg_route_studio_asset_recent_uploads
BEFORE INSERT OR UPDATE ON public.recent_uploads
FOR EACH ROW EXECUTE FUNCTION public.route_studio_asset();

DROP TRIGGER IF EXISTS trg_route_studio_asset_upload_sessions ON public.upload_sessions;
CREATE TRIGGER trg_route_studio_asset_upload_sessions
BEFORE INSERT OR UPDATE ON public.upload_sessions
FOR EACH ROW EXECUTE FUNCTION public.route_studio_asset();

DROP TRIGGER IF EXISTS trg_route_studio_asset_projects ON public.projects;
CREATE TRIGGER trg_route_studio_asset_projects
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.route_studio_asset();

-- 6. Strict cross-studio isolation as a RESTRICTIVE policy.
--    Restrictive policies AND with existing permissive policies, so we
--    keep all current workspace-member access intact and simply add a
--    second gate: the row's banner must match a workspace the caller
--    belongs to (or the caller is the super admin / platform admin).
--    NULL banners (legacy rows) stay reachable so nothing breaks.

DROP POLICY IF EXISTS studio_isolation_recent_uploads  ON public.recent_uploads;
CREATE POLICY studio_isolation_recent_uploads
ON public.recent_uploads AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
);

DROP POLICY IF EXISTS studio_isolation_upload_sessions ON public.upload_sessions;
CREATE POLICY studio_isolation_upload_sessions
ON public.upload_sessions AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
);

DROP POLICY IF EXISTS studio_isolation_projects ON public.projects;
CREATE POLICY studio_isolation_projects
ON public.projects AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR production_banner IS NULL
  OR public.user_in_banner(auth.uid(), production_banner)
);
