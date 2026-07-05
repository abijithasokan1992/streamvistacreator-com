
ALTER TABLE public.legacy_film_imports
  ADD COLUMN IF NOT EXISTS recovery_email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS legacy_film_imports_uploader_email_idx
  ON public.legacy_film_imports (lower(uploader_email));

-- Admin-only helper: unique uploader emails still needing a recovery invite
CREATE OR REPLACE FUNCTION public.pending_legacy_recovery_emails()
RETURNS TABLE(uploader_email text, film_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(uploader_email) AS uploader_email, count(*)::bigint AS film_count
  FROM public.legacy_film_imports
  WHERE uploader_email IS NOT NULL
    AND uploader_email <> ''
    AND recovery_email_sent_at IS NULL
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  GROUP BY lower(uploader_email)
  ORDER BY lower(uploader_email);
$$;

REVOKE ALL ON FUNCTION public.pending_legacy_recovery_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pending_legacy_recovery_emails() TO authenticated;
