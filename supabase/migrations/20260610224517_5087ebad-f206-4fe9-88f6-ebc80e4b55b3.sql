
-- =========================
-- upload_sessions
-- =========================
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid,
  file_name text NOT NULL,
  file_size bigint,
  file_sha256 text,
  mime_type text,
  oci_upload_id text,
  object_key text,
  total_chunks integer,
  uploaded_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT upload_sessions_status_chk
    CHECK (status IN ('pending','processing','completed','failed','aborted'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_sessions TO authenticated;
GRANT ALL ON public.upload_sessions TO service_role;

ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "upload_sessions_owner_select"
  ON public.upload_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "upload_sessions_owner_insert"
  ON public.upload_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upload_sessions_owner_update"
  ON public.upload_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "upload_sessions_owner_delete"
  ON public.upload_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS upload_sessions_user_sha_idx
  ON public.upload_sessions (user_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS upload_sessions_user_status_idx
  ON public.upload_sessions (user_id, status, updated_at DESC);

CREATE TRIGGER upload_sessions_touch_updated_at
  BEFORE UPDATE ON public.upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- ingest_telemetry
-- =========================
CREATE TABLE IF NOT EXISTS public.ingest_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.upload_sessions(id) ON DELETE CASCADE,
  oci_upload_id text,
  part_number integer,
  event text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  duration_ms integer,
  bytes bigint,
  http_status integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingest_telemetry_severity_chk
    CHECK (severity IN ('info','warn','error'))
);

GRANT SELECT ON public.ingest_telemetry TO authenticated;
GRANT ALL ON public.ingest_telemetry TO service_role;

ALTER TABLE public.ingest_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingest_telemetry_owner_select"
  ON public.ingest_telemetry FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ingest_telemetry_session_idx
  ON public.ingest_telemetry (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ingest_telemetry_user_idx
  ON public.ingest_telemetry (user_id, created_at DESC);
