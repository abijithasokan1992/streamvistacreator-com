-- pgmq DLQ helpers. Wrapped in SECURITY DEFINER so the service role can drain
-- the dead-letter tables that the pgmq extension owns.
CREATE OR REPLACE FUNCTION public.pgmq_read_dlq(queue_name text, n integer DEFAULT 100)
RETURNS TABLE(msg_id bigint, enqueued_at timestamptz, message jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT msg_id, enqueued_at, message FROM pgmq.%I ORDER BY enqueued_at LIMIT %s',
    queue_name || '_dlq', n
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pgmq_delete_dlq(queue_name text, msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pgmq
AS $$
BEGIN
  EXECUTE format('DELETE FROM pgmq.%I WHERE msg_id = $1', queue_name || '_dlq') USING msg_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.pgmq_read_dlq(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pgmq_delete_dlq(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pgmq_read_dlq(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.pgmq_delete_dlq(text, bigint) TO service_role;

-- Schedule the two sweepers every 5 minutes.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any pre-existing schedule with the same name so re-running is safe.
SELECT cron.unschedule('retry-failed-uploads-5min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'retry-failed-uploads-5min'
);
SELECT cron.unschedule('retry-failed-emails-5min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'retry-failed-emails-5min'
);

SELECT cron.schedule(
  'retry-failed-uploads-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/retry-failed-uploads',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGdta2ZxZ2V1cWxtcGNpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1MTcsImV4cCI6MjA5NDY0MDUxN30.0X_qVm8wGWLxQ9hPx7wdAbmzYIsC5FFH8taYY1aevSs'
      ),
      body := jsonb_build_object('trigger', 'cron', 'at', now())
    );
  $$
);

SELECT cron.schedule(
  'retry-failed-emails-5min',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/retry-failed-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbGdta2ZxZ2V1cWxtcGNpcnZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjQ1MTcsImV4cCI6MjA5NDY0MDUxN30.0X_qVm8wGWLxQ9hPx7wdAbmzYIsC5FFH8taYY1aevSs'
      ),
      body := jsonb_build_object('trigger', 'cron', 'at', now())
    );
  $$
);