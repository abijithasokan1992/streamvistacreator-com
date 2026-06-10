ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS recipient_email TEXT;

CREATE OR REPLACE FUNCTION public.shared_files_normalize_recipient()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.recipient_email IS NOT NULL THEN
    NEW.recipient_email := lower(trim(NEW.recipient_email));
    IF NEW.recipient_email = '' THEN NEW.recipient_email := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shared_files_normalize_recipient ON public.shared_files;
CREATE TRIGGER trg_shared_files_normalize_recipient
BEFORE INSERT OR UPDATE OF recipient_email ON public.shared_files
FOR EACH ROW EXECUTE FUNCTION public.shared_files_normalize_recipient();

CREATE INDEX IF NOT EXISTS idx_shared_files_recipient_email
  ON public.shared_files (recipient_email)
  WHERE recipient_email IS NOT NULL;

DROP POLICY IF EXISTS "Recipients can read shares addressed to them" ON public.shared_files;
CREATE POLICY "Recipients can read shares addressed to them"
ON public.shared_files
FOR SELECT
TO authenticated
USING (
  recipient_email IS NOT NULL
  AND recipient_email = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
);