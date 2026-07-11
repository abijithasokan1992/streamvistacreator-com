
-- DIT Master Compliance & Ingest Protocol log table
CREATE TABLE public.dit_ingest_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  production_name TEXT NOT NULL,
  shoot_date DATE NOT NULL,
  selected_mode TEXT NOT NULL CHECK (selected_mode IN ('mode_1_physical_plus_cloud','mode_2_local_master_cloud_proxies','mode_3_pure_cloud_ingest')),
  replication_regions SMALLINT CHECK (replication_regions IS NULL OR replication_regions BETWEEN 1 AND 3),
  camera_mapping JSONB NOT NULL DEFAULT '[]'::jsonb,
  checklist_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  screenshot_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dit_ingest_logs TO authenticated;
GRANT ALL ON public.dit_ingest_logs TO service_role;

ALTER TABLE public.dit_ingest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DIT logs: owners can select"
  ON public.dit_ingest_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "DIT logs: owners can insert"
  ON public.dit_ingest_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "DIT logs: owners can update"
  ON public.dit_ingest_logs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "DIT logs: owners can delete"
  ON public.dit_ingest_logs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Admin visibility (reuse existing has_role convention)
CREATE POLICY "DIT logs: admins can select all"
  ON public.dit_ingest_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX idx_dit_ingest_logs_user_created ON public.dit_ingest_logs(user_id, created_at DESC);
CREATE INDEX idx_dit_ingest_logs_workspace ON public.dit_ingest_logs(workspace_id);

-- updated_at trigger (reuses shared function if present)
CREATE OR REPLACE FUNCTION public.tg_dit_ingest_logs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dit_ingest_logs_updated_at
  BEFORE UPDATE ON public.dit_ingest_logs
  FOR EACH ROW EXECUTE FUNCTION public.tg_dit_ingest_logs_updated_at();
