DROP POLICY IF EXISTS "Recipients can read shares addressed to them" ON public.shared_files;

CREATE POLICY "Recipients can read shares addressed to them"
ON public.shared_files
FOR SELECT
TO authenticated
USING (
  recipient_email IS NOT NULL
  AND recipient_email = lower(coalesce(
    (auth.jwt() ->> 'email'),
    ''
  ))
);