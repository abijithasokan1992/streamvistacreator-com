
-- 1) Lock down the audit-log trigger function so signed-in users can't invoke it directly
REVOKE EXECUTE ON FUNCTION public.log_onboarding_status_changes() FROM PUBLIC, anon, authenticated;

-- 2) Tighten DMCA evidence bucket: size + mime restrictions
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png','image/jpeg','image/webp','image/gif',
      'video/mp4','video/quicktime',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
WHERE id = 'dmca-evidence';

-- 3) Replace permissive upload policy with a path-restricted one
DROP POLICY IF EXISTS "Public can upload DMCA evidence" ON storage.objects;

CREATE POLICY "Public can upload DMCA evidence (scoped)"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'dmca-evidence'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._\-]{1,200}\.(pdf|png|jpe?g|webp|gif|mp4|mov|txt|docx?|PDF|PNG|JPE?G|WEBP|GIF|MP4|MOV|TXT|DOCX?)$'
);
