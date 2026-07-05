CREATE TABLE IF NOT EXISTS public.ingest_job_insert_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid,
  project_id uuid,
  reason text NOT NULL,
  error_code text,
  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ingest_job_insert_failures TO authenticated;
GRANT ALL ON public.ingest_job_insert_failures TO service_role;

ALTER TABLE public.ingest_job_insert_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own ingest failures"
ON public.ingest_job_insert_failures
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read their own ingest failures"
ON public.ingest_job_insert_failures
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS ingest_job_insert_failures_user_idx
  ON public.ingest_job_insert_failures(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ingest_job_insert_failures_workspace_idx
  ON public.ingest_job_insert_failures(workspace_id, created_at DESC);