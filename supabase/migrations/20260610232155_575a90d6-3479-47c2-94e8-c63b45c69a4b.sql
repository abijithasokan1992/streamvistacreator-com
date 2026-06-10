
-- 1. REPLICA IDENTITY FULL for asset/file metadata tables
ALTER TABLE public.recent_uploads REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.upload_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.ingest_telemetry REPLICA IDENTITY FULL;

-- 2. Realtime channel-level authorization (realtime.messages)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Helper: extract workspace UUID from a topic string of the form "ws:<uuid>:*"
CREATE OR REPLACE FUNCTION public.realtime_topic_workspace(_topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _topic ~* '^ws:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    THEN substring(_topic from 4 for 36)::uuid
    ELSE NULL
  END;
$$;

-- Drop any pre-existing policies (idempotent)
DROP POLICY IF EXISTS "realtime_authenticated_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_workspace_scoped_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_workspace_scoped_write" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_admin_full" ON realtime.messages;

-- Admins always allowed
CREATE POLICY "realtime_admin_full"
  ON realtime.messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated users may receive messages on topics that either
--   (a) are not workspace-scoped (postgres_changes table channels rely on
--       table-level RLS of recent_uploads/checklist_overrides), OR
--   (b) carry a ws:<workspace_id>: prefix and the user is a verified member.
CREATE POLICY "realtime_workspace_scoped_read"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.realtime_topic_workspace(topic) IS NULL
    OR public.is_workspace_member(public.realtime_topic_workspace(topic), auth.uid())
  );

-- Same rule for broadcast/presence inserts
CREATE POLICY "realtime_workspace_scoped_write"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.realtime_topic_workspace(topic) IS NULL
    OR public.is_workspace_member(public.realtime_topic_workspace(topic), auth.uid())
  );

-- 3. Tighten onboarding_requests authenticated insert policy: do NOT allow
--    authenticated users to create rows with NULL submitter (orphaned PII).
DROP POLICY IF EXISTS onboarding_requests_auth_insert ON public.onboarding_requests;
CREATE POLICY onboarding_requests_auth_insert
  ON public.onboarding_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitter_user_id = auth.uid());
