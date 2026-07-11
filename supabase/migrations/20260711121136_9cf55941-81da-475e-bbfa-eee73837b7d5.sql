-- Fix pgmq DLQ helpers to use the pgmq extension's real table naming
-- convention: `pgmq.q_<queue>_dlq` (the extension prefixes queue tables with `q_`).
-- The previous versions targeted `pgmq.<queue>_dlq` which does not exist and
-- caused the scheduled retry-failed-emails sweeper to fail every run.

CREATE OR REPLACE FUNCTION public.pgmq_read_dlq(queue_name text, n integer DEFAULT 100)
RETURNS TABLE(msg_id bigint, enqueued_at timestamp with time zone, message jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT msg_id, enqueued_at, message FROM pgmq.%I ORDER BY enqueued_at LIMIT %s',
    'q_' || queue_name || '_dlq', n
  );
EXCEPTION WHEN undefined_table THEN
  -- DLQ not yet materialised (no failures ever) — return empty set, not error.
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pgmq_delete_dlq(queue_name text, msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  EXECUTE format('DELETE FROM pgmq.%I WHERE msg_id = $1', 'q_' || queue_name || '_dlq') USING msg_id;
  RETURN FOUND;
EXCEPTION WHEN undefined_table THEN
  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.pgmq_read_dlq(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pgmq_delete_dlq(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pgmq_read_dlq(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.pgmq_delete_dlq(text, bigint) TO service_role;