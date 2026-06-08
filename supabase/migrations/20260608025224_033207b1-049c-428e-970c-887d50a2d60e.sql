
-- Vault: per-file salt for password hashing
ALTER TABLE public.shared_files ADD COLUMN IF NOT EXISTS password_salt text;

-- Storage: vault UPDATE policy (owner-scoped)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Vault owners can update'
  ) THEN
    CREATE POLICY "Vault owners can update"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Storage: dmca-evidence DELETE policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins delete DMCA evidence'
  ) THEN
    CREATE POLICY "Admins delete DMCA evidence"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'dmca-evidence' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
