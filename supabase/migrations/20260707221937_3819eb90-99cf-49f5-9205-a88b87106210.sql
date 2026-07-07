
CREATE OR REPLACE FUNCTION public.admin_infra_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron, pgmq, extensions
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  cron_jobs jsonb;
  queue_depths jsonb;
  dlq_counts jsonb;
  recent_email_errors jsonb;
  recent_upload_errors jsonb;
  q record;
  qd jsonb := '{}'::jsonb;
  dq jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Cron jobs (name, schedule, active, last status if available).
  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
      'jobname', j.jobname,
      'schedule', j.schedule,
      'active', j.active,
      'last_status', d.status,
      'last_start', d.start_time,
      'last_end', d.end_time
    ) ORDER BY j.jobname)
    INTO cron_jobs
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT status, start_time, end_time
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC NULLS LAST
      LIMIT 1
    ) d ON true;
  EXCEPTION WHEN OTHERS THEN
    cron_jobs := jsonb_build_object('error', SQLERRM);
  END;

  -- pgmq queue depths + DLQ depths for the transactional/auth email queues.
  BEGIN
    FOR q IN
      SELECT queue_name FROM pgmq.list_queues()
    LOOP
      BEGIN
        EXECUTE format('SELECT count(*) FROM pgmq.q_%I', q.queue_name) INTO n;
        qd := qd || jsonb_build_object(q.queue_name, n);
      EXCEPTION WHEN OTHERS THEN
        qd := qd || jsonb_build_object(q.queue_name, NULL);
      END;
      -- archive/dlq table (pgmq stores dead-letters in a_<queue>)
      BEGIN
        EXECUTE format('SELECT count(*) FROM pgmq.a_%I', q.queue_name) INTO n;
        dq := dq || jsonb_build_object(q.queue_name, n);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
    queue_depths := qd;
    dlq_counts := dq;
  EXCEPTION WHEN OTHERS THEN
    queue_depths := jsonb_build_object('error', SQLERRM);
    dlq_counts := jsonb_build_object('error', SQLERRM);
  END;

  -- Recent email failures (24h) with last error message.
  SELECT jsonb_build_object(
    'failed_24h', (
      SELECT count(*) FROM (
        SELECT DISTINCT ON (message_id) status
        FROM public.email_send_log
        WHERE message_id IS NOT NULL
          AND created_at > now() - interval '24 hours'
        ORDER BY message_id, created_at DESC
      ) latest WHERE status IN ('failed','bounced','complained','dlq')
    ),
    'last_error', (
      SELECT jsonb_build_object(
        'template', template_name,
        'recipient', recipient_email,
        'status', status,
        'error', error_message,
        'created_at', created_at
      )
      FROM public.email_send_log
      WHERE status IN ('failed','bounced','complained','dlq')
      ORDER BY created_at DESC LIMIT 1
    )
  ) INTO recent_email_errors;

  -- Recent upload failures (24h) with last diagnostic.
  SELECT jsonb_build_object(
    'failed_24h', (
      SELECT count(*) FROM public.ingest_job_items
      WHERE status = 'failed' AND updated_at > now() - interval '24 hours'
    ),
    'stale_inflight', (
      SELECT count(*) FROM public.ingest_job_items
      WHERE status IN ('uploading','retrying','verifying','paused')
        AND updated_at < now() - interval '30 minutes'
    ),
    'last_error', (
      SELECT jsonb_build_object(
        'file_name', file_name,
        'error', error_message,
        'diagnostic', metadata->'upload_diagnostic',
        'updated_at', updated_at
      )
      FROM public.ingest_job_items
      WHERE status = 'failed'
      ORDER BY updated_at DESC LIMIT 1
    )
  ) INTO recent_upload_errors;

  result := jsonb_build_object(
    'cron_jobs', COALESCE(cron_jobs, '[]'::jsonb),
    'queue_depths', COALESCE(queue_depths, '{}'::jsonb),
    'dlq_counts', COALESCE(dlq_counts, '{}'::jsonb),
    'email', recent_email_errors,
    'uploads', recent_upload_errors,
    'db_time', now()
  );
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_infra_snapshot() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_infra_snapshot() TO authenticated;
