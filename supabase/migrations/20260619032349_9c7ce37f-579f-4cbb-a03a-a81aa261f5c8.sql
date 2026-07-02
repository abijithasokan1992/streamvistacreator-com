DROP POLICY IF EXISTS "Public can submit contact messages" ON public.contact_messages;

CREATE POLICY "Public can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  name IS NOT NULL
  AND length(btrim(name)) BETWEEN 1 AND 120
  AND email IS NOT NULL
  AND length(email) BETWEEN 3 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND message IS NOT NULL
  AND length(btrim(message)) BETWEEN 1 AND 4000
  AND (company IS NULL OR length(company) <= 160)
  AND (role IS NULL OR length(role) <= 80)
  AND status = 'new'
);