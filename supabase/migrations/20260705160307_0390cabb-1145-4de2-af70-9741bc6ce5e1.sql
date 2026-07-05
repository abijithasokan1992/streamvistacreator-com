-- Replace the overly-restrictive INSERT policy on ingest_jobs so any workspace
-- member can create their own ingest jobs. The prior policy required both
-- workspace admin AND (platform admin OR premium storage entitlement), which
-- blocked normal DITs from starting an upload.
DROP POLICY IF EXISTS "Premium members can create ingest jobs" ON public.ingest_jobs;

CREATE POLICY "Members can create their own ingest jobs"
ON public.ingest_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_workspace_member(workspace_id, auth.uid())
);

-- Do the same for the child tables so the whole insert chain succeeds.
DROP POLICY IF EXISTS "Premium members can create ingest sources" ON public.ingest_sources;
CREATE POLICY "Members can create their own ingest sources"
ON public.ingest_sources
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_workspace_member(workspace_id, auth.uid())
);

DROP POLICY IF EXISTS "Premium members can create ingest job items" ON public.ingest_job_items;
CREATE POLICY "Members can create ingest job items on their jobs"
ON public.ingest_job_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ingest_jobs j
    WHERE j.id = ingest_job_items.job_id
      AND (
        j.created_by = auth.uid()
        OR public.is_workspace_admin(j.workspace_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  )
);