
CREATE OR REPLACE FUNCTION public.admin_failure_counts(stale_minutes int DEFAULT 30)
RETURNS TABLE(failed_uploads bigint, failed_emails bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      SELECT count(*) FROM public.ingest_job_items
      WHERE status = 'failed'
         OR (status IN ('uploading','retrying','verifying','paused')
             AND updated_at < now() - make_interval(mins => stale_minutes))
    ) AS failed_uploads,
    (
      SELECT count(*) FROM (
        SELECT DISTINCT ON (message_id) status
        FROM public.email_send_log
        WHERE message_id IS NOT NULL
        ORDER BY message_id, created_at DESC
      ) latest
      WHERE status IN ('failed','bounced','complained','dlq')
    ) AS failed_emails
  WHERE public.has_role(auth.uid(), 'admin'::app_role);
$$;

REVOKE ALL ON FUNCTION public.admin_failure_counts(int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_failure_counts(int) TO authenticated;
