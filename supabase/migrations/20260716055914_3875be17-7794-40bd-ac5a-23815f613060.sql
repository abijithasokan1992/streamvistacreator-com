
-- 1. DIT storage.objects policies: relax `owner=auth.uid()` (unreliable across
--    client versions) and rely on the folder-scoped path check. Recreate all
--    four policies (upload/read/update/delete) with consistent, path-based
--    ownership.
DROP POLICY IF EXISTS "DIT screenshots: users can upload own" ON storage.objects;
DROP POLICY IF EXISTS "DIT screenshots: users can read own"   ON storage.objects;
DROP POLICY IF EXISTS "DIT screenshots: users can update own" ON storage.objects;
DROP POLICY IF EXISTS "DIT screenshots: users can delete own" ON storage.objects;

CREATE POLICY "DIT screenshots: users can upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "DIT screenshots: users can read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "DIT screenshots: users can update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "DIT screenshots: users can delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Allow system-authored audit rows (edge functions) to persist without a
--    named admin actor. `admin_user_id` NOT NULL was blocking the
--    `retry-failed-emails` sweeper's audit-log write, which surfaced in the
--    Admin panel as "audit failed".
ALTER TABLE public.admin_audit_log
  ALTER COLUMN admin_user_id DROP NOT NULL;
