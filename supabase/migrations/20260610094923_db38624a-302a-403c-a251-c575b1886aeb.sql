
DROP POLICY IF EXISTS "Recipients can read shares addressed to them" ON public.shared_files;

CREATE OR REPLACE FUNCTION public.list_shares_for_me()
RETURNS TABLE (
  id uuid,
  filename text,
  share_token text,
  expires_at timestamptz,
  revoked boolean,
  has_password boolean,
  view_only boolean,
  created_at timestamptz,
  size_bytes bigint,
  mime_type text,
  tier text,
  download_count integer,
  max_downloads integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, filename, share_token, expires_at, revoked,
         has_password, view_only, created_at, size_bytes,
         mime_type, tier, download_count, max_downloads
  FROM public.shared_files
  WHERE recipient_email IS NOT NULL
    AND recipient_email = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND revoked = false
  ORDER BY created_at DESC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.list_shares_for_me() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_shares_for_me() TO authenticated;
