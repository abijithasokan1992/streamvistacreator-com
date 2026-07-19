CREATE POLICY "MCP control roles can view all ingest_jobs"
  ON public.ingest_jobs
  FOR SELECT
  TO authenticated
  USING (public.has_mcp_control_role(auth.uid()));

CREATE POLICY "MCP control roles can view all ingest_job_items"
  ON public.ingest_job_items
  FOR SELECT
  TO authenticated
  USING (public.has_mcp_control_role(auth.uid()));