
-- ============================================================
-- studio_assets: logical asset grouping over recent_uploads
-- ============================================================
CREATE TABLE public.studio_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  asset_type text NOT NULL DEFAULT 'clip',
    -- clip | reel | master | dcp | imf | project_bundle | other
  primary_upload_id uuid REFERENCES public.recent_uploads(id) ON DELETE SET NULL,
  total_size_bytes bigint NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  sidecar_kinds text[] NOT NULL DEFAULT '{}',
  camera_make text,
  camera_model text,
  codec text,
  resolution text,
  fps numeric,
  shoot_date date,
  status text NOT NULL DEFAULT 'active',
    -- active | archived | restoring | deleted
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_assets TO authenticated;
GRANT ALL ON public.studio_assets TO service_role;

ALTER TABLE public.studio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio members can view their workspace assets"
  ON public.studio_assets FOR SELECT TO authenticated
  USING (
    public.is_workspace_admin(workspace_id, auth.uid())
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Studio owners can insert their assets"
  ON public.studio_assets FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "Studio owners and workspace admins can update"
  ON public.studio_assets FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete studio assets"
  ON public.studio_assets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_studio_assets_workspace ON public.studio_assets(workspace_id, created_at DESC);
CREATE INDEX idx_studio_assets_project ON public.studio_assets(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_studio_assets_status ON public.studio_assets(status, created_at DESC);
CREATE INDEX idx_studio_assets_owner ON public.studio_assets(owner_id, created_at DESC);

-- ============================================================
-- studio_asset_files: join from studio_assets to recent_uploads
-- ============================================================
CREATE TABLE public.studio_asset_files (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES public.studio_assets(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES public.recent_uploads(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary',
    -- primary | sidecar | proxy | thumbnail | audio | subtitle | other
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, upload_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_asset_files TO authenticated;
GRANT ALL ON public.studio_asset_files TO service_role;

ALTER TABLE public.studio_asset_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view asset files for their assets"
  ON public.studio_asset_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.studio_assets a
      WHERE a.id = studio_asset_files.asset_id
        AND (
          a.owner_id = auth.uid()
          OR public.is_workspace_admin(a.workspace_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE POLICY "Members can manage asset files for their assets"
  ON public.studio_asset_files FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.studio_assets a
      WHERE a.id = studio_asset_files.asset_id
        AND (
          a.owner_id = auth.uid()
          OR public.is_workspace_admin(a.workspace_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studio_assets a
      WHERE a.id = studio_asset_files.asset_id
        AND (
          a.owner_id = auth.uid()
          OR public.is_workspace_admin(a.workspace_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );

CREATE INDEX idx_studio_asset_files_asset ON public.studio_asset_files(asset_id, sort_order);
CREATE INDEX idx_studio_asset_files_upload ON public.studio_asset_files(upload_id);

-- ============================================================
-- archive_jobs: snapshot studio asset into cold tier
-- ============================================================
CREATE TABLE public.archive_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.studio_assets(id) ON DELETE SET NULL,
  source_tier text NOT NULL DEFAULT 'standard',
  target_tier text NOT NULL DEFAULT 'archive',
    -- standard | infrequent | archive | deep_archive
  target_location text,
  total_bytes bigint NOT NULL DEFAULT 0,
  transferred_bytes bigint NOT NULL DEFAULT 0,
  progress_percent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued',
    -- queued | running | verifying | completed | failed | cancelled
  checksum_algo text NOT NULL DEFAULT 'sha256',
  checksum_value text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.archive_jobs TO authenticated;
GRANT ALL ON public.archive_jobs TO service_role;

ALTER TABLE public.archive_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view archive jobs in their workspace"
  ON public.archive_jobs FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Members can request archive jobs"
  ON public.archive_jobs FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "Admins can update archive jobs"
  ON public.archive_jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_archive_jobs_workspace ON public.archive_jobs(workspace_id, created_at DESC);
CREATE INDEX idx_archive_jobs_status ON public.archive_jobs(status, created_at DESC);
CREATE INDEX idx_archive_jobs_asset ON public.archive_jobs(asset_id) WHERE asset_id IS NOT NULL;

-- ============================================================
-- restore_jobs: pull archived asset back to working tier
-- ============================================================
CREATE TABLE public.restore_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.studio_assets(id) ON DELETE SET NULL,
  archive_job_id uuid REFERENCES public.archive_jobs(id) ON DELETE SET NULL,
  target_tier text NOT NULL DEFAULT 'standard',
  total_bytes bigint NOT NULL DEFAULT 0,
  transferred_bytes bigint NOT NULL DEFAULT 0,
  progress_percent numeric NOT NULL DEFAULT 0,
  eta_seconds integer,
  status text NOT NULL DEFAULT 'queued',
    -- queued | thawing | running | verifying | completed | failed | cancelled
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.restore_jobs TO authenticated;
GRANT ALL ON public.restore_jobs TO service_role;

ALTER TABLE public.restore_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view restore jobs in their workspace"
  ON public.restore_jobs FOR SELECT TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.is_workspace_admin(workspace_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Members can request restore jobs"
  ON public.restore_jobs FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "Admins can update restore jobs"
  ON public.restore_jobs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_restore_jobs_workspace ON public.restore_jobs(workspace_id, created_at DESC);
CREATE INDEX idx_restore_jobs_status ON public.restore_jobs(status, created_at DESC);
CREATE INDEX idx_restore_jobs_asset ON public.restore_jobs(asset_id) WHERE asset_id IS NOT NULL;

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_ingest_pipeline_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_studio_assets_updated_at
  BEFORE UPDATE ON public.studio_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();

CREATE TRIGGER trg_archive_jobs_updated_at
  BEFORE UPDATE ON public.archive_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();

CREATE TRIGGER trg_restore_jobs_updated_at
  BEFORE UPDATE ON public.restore_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();
