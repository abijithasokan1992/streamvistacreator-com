-- 1) Pin search_path on the helper function
CREATE OR REPLACE FUNCTION public.realtime_topic_workspace(_topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _topic ~* '^ws:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    THEN substring(_topic from 4 for 36)::uuid
    ELSE NULL
  END;
$$;

-- 2) Tighten realtime.messages policies: deny non-workspace topics
DROP POLICY IF EXISTS realtime_workspace_scoped_read ON realtime.messages;
DROP POLICY IF EXISTS realtime_workspace_scoped_write ON realtime.messages;

CREATE POLICY realtime_workspace_scoped_read
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.realtime_topic_workspace((SELECT realtime.topic())) IS NOT NULL
    AND public.is_workspace_member(
      public.realtime_topic_workspace((SELECT realtime.topic())),
      auth.uid()
    )
  )
);

CREATE POLICY realtime_workspace_scoped_write
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.realtime_topic_workspace((SELECT realtime.topic())) IS NOT NULL
    AND public.is_workspace_member(
      public.realtime_topic_workspace((SELECT realtime.topic())),
      auth.uid()
    )
  )
);

-- 3) Drop the over-permissive cross-user vault read policy.
-- Owners, admins, and assigned EPs retain access via their own policies;
-- cross-user sharing must happen through explicit shared_files links.
DROP POLICY IF EXISTS "Workspace members read shared vault" ON storage.objects;
