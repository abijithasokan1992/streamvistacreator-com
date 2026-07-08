
-- 1. Ensure Abijith Asokan has admin + super_admin roles (idempotent)
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('75537ca1-e84f-4e80-a468-f38dc157a2ac', 'admin'::app_role),
  ('75537ca1-e84f-4e80-a468-f38dc157a2ac', 'super_admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Data-API grants (missing → causes "Could not load invitations")
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_invitations TO authenticated;
GRANT ALL ON public.role_invitations TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 3. Recreate the global maintenance RPC (admin-gated)
CREATE OR REPLACE FUNCTION public.handle_global_platform_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uploads int := 0;
  v_emails  int := 0;
  v_legal   int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'insufficient_privilege: admin role required';
  END IF;

  WITH upd AS (
    UPDATE public.ingest_job_items
       SET status = 'queued',
           error_message = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'requeued_by_maintenance_at', now(),
                           'previous_error', error_message
                         ),
           updated_at = now()
     WHERE status = 'failed'
     RETURNING 1
  )
  SELECT count(*) INTO v_uploads FROM upd;

  WITH upd AS (
    UPDATE public.email_send_log
       SET status = 'pending',
           error_message = NULL,
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'requeued_by_maintenance_at', now(),
                           'previous_error', error_message
                         )
     WHERE status = 'failed'
     RETURNING 1
  )
  SELECT count(*) INTO v_emails FROM upd;

  WITH upd AS (
    UPDATE public.content_titles ct
       SET status = 'legal_review'::content_status,
           updated_at = now()
     WHERE ct.status = 'legal_review'::content_status
       AND NOT EXISTS (
         SELECT 1 FROM public.title_review_assignments a
          WHERE a.title_id = ct.id AND a.stage = 'legal'
       )
     RETURNING 1
  )
  SELECT count(*) INTO v_legal FROM upd;

  RETURN jsonb_build_object(
    'uploads_requeued', v_uploads,
    'emails_requeued',  v_emails,
    'legal_reviews_reset', v_legal,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.handle_global_platform_maintenance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_global_platform_maintenance() TO authenticated;
