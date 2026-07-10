
WITH updated AS (
  UPDATE public.recent_uploads
     SET status = 'superseded',
         updated_at = now()
   WHERE status = 'failed'
     AND (
       error_message ILIKE '%superseded by retry%'
       OR error_message ILIKE 'reclaim: stale upload aborted%'
     )
  RETURNING id, file_name, error_message, user_id
)
INSERT INTO public.admin_audit_log (admin_user_id, admin_email, target_user_id, action, details)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  'system@streamvista',
  u.user_id,
  'upload_status_reclassified',
  jsonb_build_object(
    'from', 'failed',
    'to', 'superseded',
    'reason', u.error_message,
    'file_name', u.file_name,
    'upload_id', u.id,
    'migration', 'reclassify_superseded_uploads_2026_07_10'
  )
FROM updated u;
