
-- ============================================================
-- INGEST SOURCES
-- ============================================================
CREATE TABLE public.ingest_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('external_drive','camera_card','folder','watch_folder','archive_drive')),
  label text NOT NULL,
  source_identifier text,
  path_hint text,
  agent_device_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingest_sources_workspace ON public.ingest_sources(workspace_id, created_at DESC);
CREATE INDEX idx_ingest_sources_type ON public.ingest_sources(source_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_sources TO authenticated;
GRANT ALL ON public.ingest_sources TO service_role;
ALTER TABLE public.ingest_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ingest sources in their workspace"
  ON public.ingest_sources FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Members can create ingest sources in their workspace"
  ON public.ingest_sources FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Owners and workspace admins can update ingest sources"
  ON public.ingest_sources FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can delete ingest sources"
  ON public.ingest_sources FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_ingest_sources_updated_at
  BEFORE UPDATE ON public.ingest_sources
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();

-- ============================================================
-- INGEST JOBS
-- ============================================================
CREATE TABLE public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.ingest_sources(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title_id uuid,
  job_mode text NOT NULL CHECK (job_mode IN ('connected_drive','camera_card','watch_folder','archive')),
  destination_type text NOT NULL DEFAULT 'working_vault' CHECK (destination_type IN ('working_vault','archive_vault')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scanning','ready','uploading','paused','retrying','verifying','completed','failed','cancelled')),
  preserve_structure boolean NOT NULL DEFAULT true,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  shoot_day text,
  camera_label text,
  asset_class text,
  total_bytes bigint NOT NULL DEFAULT 0,
  transferred_bytes bigint NOT NULL DEFAULT 0,
  total_files integer NOT NULL DEFAULT 0,
  completed_files integer NOT NULL DEFAULT 0,
  failed_files integer NOT NULL DEFAULT 0,
  notes text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingest_jobs_workspace ON public.ingest_jobs(workspace_id, created_at DESC);
CREATE INDEX idx_ingest_jobs_status ON public.ingest_jobs(status, created_at DESC);
CREATE INDEX idx_ingest_jobs_project ON public.ingest_jobs(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_ingest_jobs_mode ON public.ingest_jobs(job_mode);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_jobs TO authenticated;
GRANT ALL ON public.ingest_jobs TO service_role;
ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ingest jobs in their workspace"
  ON public.ingest_jobs FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Members can create ingest jobs"
  ON public.ingest_jobs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Job creators and workspace admins can update ingest jobs"
  ON public.ingest_jobs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (created_by = auth.uid() OR is_workspace_admin(workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admins can delete ingest jobs"
  ON public.ingest_jobs FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();

-- ============================================================
-- INGEST JOB ITEMS
-- ============================================================
CREATE TABLE public.ingest_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ingest_jobs(id) ON DELETE CASCADE,
  relative_path text NOT NULL DEFAULT '',
  file_name text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_guess text,
  asset_class text,
  upload_id uuid REFERENCES public.recent_uploads(id) ON DELETE SET NULL,
  upload_session_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','uploading','paused','retrying','verifying','completed','failed','skipped')),
  progress_percent numeric NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ingest_job_items_job ON public.ingest_job_items(job_id, created_at);
CREATE INDEX idx_ingest_job_items_status ON public.ingest_job_items(status);
CREATE INDEX idx_ingest_job_items_upload ON public.ingest_job_items(upload_id) WHERE upload_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_job_items TO authenticated;
GRANT ALL ON public.ingest_job_items TO service_role;
ALTER TABLE public.ingest_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ingest job items in their workspace"
  ON public.ingest_job_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ingest_jobs j
    WHERE j.id = ingest_job_items.job_id
      AND (j.created_by = auth.uid() OR is_workspace_admin(j.workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  ));

CREATE POLICY "Members can create ingest job items for their jobs"
  ON public.ingest_job_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ingest_jobs j
    WHERE j.id = ingest_job_items.job_id
      AND j.created_by = auth.uid()
      AND is_workspace_admin(j.workspace_id, auth.uid())
  ));

CREATE POLICY "Job owners and workspace admins can update ingest job items"
  ON public.ingest_job_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ingest_jobs j
    WHERE j.id = ingest_job_items.job_id
      AND (j.created_by = auth.uid() OR is_workspace_admin(j.workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ingest_jobs j
    WHERE j.id = ingest_job_items.job_id
      AND (j.created_by = auth.uid() OR is_workspace_admin(j.workspace_id, auth.uid()) OR has_role(auth.uid(),'admin'::app_role))
  ));

CREATE POLICY "Admins can delete ingest job items"
  ON public.ingest_job_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_ingest_job_items_updated_at
  BEFORE UPDATE ON public.ingest_job_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();
