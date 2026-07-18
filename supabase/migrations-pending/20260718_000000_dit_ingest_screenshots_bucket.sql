-- ============================================================================
-- PENDING (NOT EXECUTED) — DIT ingest evidence: private storage bucket + RLS
--
-- Provisions the private `dit-ingest-screenshots` bucket referenced by
-- src/components/studio/dit/DitIngestProtocol.tsx and least-privilege
-- storage.objects policies scoped to the owning Studio user / workspace and
-- authorized Admin / QC reviewers.
--
-- ▸ Idempotent: every statement uses ON CONFLICT / IF NOT EXISTS / DROP…IF EXISTS
-- ▸ Private bucket only. No `public = true`, no anonymous access.
-- ▸ RLS on storage.objects is already ENABLED by Supabase; we only add policies.
-- ▸ Object path convention (owner_id/<iso-timestamp>-<slug>.<ext>) written by
--   the UI — the first path segment is the owning auth.uid().
-- ============================================================================

-- 1. Bucket (private, capped file size, image mimes only). --------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dit-ingest-screenshots',
  'dit-ingest-screenshots',
  false,
  20 * 1024 * 1024, -- 20 MB per screenshot cap
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Policies on storage.objects. Drop-then-create for idempotency. ----------
DROP POLICY IF EXISTS "dit_screenshots_owner_read"   ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_write"  ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_admin_read"   ON storage.objects;

-- Owner (Studio user) can read their own files (path prefix = auth.uid()).
CREATE POLICY "dit_screenshots_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can insert into their own folder only.
CREATE POLICY "dit_screenshots_owner_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can overwrite their own object metadata (versioned re-uploads).
CREATE POLICY "dit_screenshots_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own screenshots (correction / GDPR).
CREATE POLICY "dit_screenshots_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin / QC reviewers get READ-ONLY access across all folders in this bucket.
-- Uses the existing SECURITY DEFINER `public.has_role(user, role)` function.
CREATE POLICY "dit_screenshots_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'platform_owner')
      OR public.has_role(auth.uid(), 'founder')
      OR public.has_role(auth.uid(), 'qc_reviewer')
    )
  );

-- No anonymous / public policy — the bucket remains fully private.
