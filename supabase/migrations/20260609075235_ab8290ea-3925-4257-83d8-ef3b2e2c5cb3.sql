
CREATE TABLE public.recent_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  bucket TEXT NOT NULL,
  namespace TEXT NOT NULL,
  region TEXT NOT NULL,
  object_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading',
  error_message TEXT,
  par_url TEXT,
  par_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_uploads TO authenticated;
GRANT ALL ON public.recent_uploads TO service_role;

ALTER TABLE public.recent_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own uploads"
  ON public.recent_uploads FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own uploads"
  ON public.recent_uploads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own uploads"
  ON public.recent_uploads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own uploads"
  ON public.recent_uploads FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_recent_uploads_touch
  BEFORE UPDATE ON public.recent_uploads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_recent_uploads_user ON public.recent_uploads(user_id, created_at DESC);
