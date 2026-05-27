
-- Vault storage bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vault', 'vault', false, 2684354560, NULL)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 2684354560, public = false;

-- shared_files table
CREATE TABLE IF NOT EXISTS public.shared_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  tier TEXT NOT NULL DEFAULT 'lite',
  share_token TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  expires_at TIMESTAMPTZ,
  max_downloads INT,
  download_count INT NOT NULL DEFAULT 0,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_files TO authenticated;
GRANT ALL ON public.shared_files TO service_role;

ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own files" ON public.shared_files
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own files" ON public.shared_files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own files" ON public.shared_files
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own files" ON public.shared_files
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all files" ON public.shared_files
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_shared_files_owner ON public.shared_files(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_files_token ON public.shared_files(share_token);

-- Storage policies: only owner can manage objects in their folder
CREATE POLICY "Owners upload to vault" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners read own vault" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete own vault" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND auth.uid()::text = (storage.foldername(name))[1]);
