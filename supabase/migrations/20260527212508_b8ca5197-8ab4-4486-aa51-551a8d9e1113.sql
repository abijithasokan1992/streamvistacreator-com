
-- 1) Remove onboarding_requests from realtime publication (PII leak via any authenticated subscription)
ALTER PUBLICATION supabase_realtime DROP TABLE public.onboarding_requests;

-- 2) Revoke anonymous EXECUTE on SECURITY DEFINER seat counter
REVOKE EXECUTE ON FUNCTION public.mfi_seats_taken() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfi_seats_taken() TO authenticated;

-- 3) Tighten mfi-proof bucket: enforce size + MIME at bucket level
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/png','image/jpeg','image/webp'
    ]
WHERE id = 'mfi-proof';

-- 4) Replace permissive upload policy with a path-restricted one (UUID prefix + allowed extension)
DROP POLICY IF EXISTS "Anyone can upload MFI proof" ON storage.objects;

CREATE POLICY "Public can upload MFI proof (scoped)"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'mfi-proof'
  AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/proof\.(pdf|png|jpe?g|webp|PDF|PNG|JPE?G|WEBP)$'
);
