
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

  -- 1. Requeue failed uploads (authoritative table: ingest_job_items)
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

  -- 2. Requeue failed transactional emails
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

  -- 3. Nudge content titles stuck in legal_review with no legal reviewer.
  --    Reviewer assignments live in public.title_review_assignments (stage='legal').
  --    Touching updated_at re-fires any auto-assign triggers wired to the table.
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
