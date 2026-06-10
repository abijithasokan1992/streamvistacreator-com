
-- ── Realtime: live counter for Crayons Bridge checklist ──
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.recent_uploads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.recent_uploads REPLICA IDENTITY FULL;

-- ── Security: ingest_telemetry write policies ──
DROP POLICY IF EXISTS ingest_telemetry_owner_insert ON public.ingest_telemetry;
CREATE POLICY ingest_telemetry_owner_insert
ON public.ingest_telemetry FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ingest_telemetry_owner_update ON public.ingest_telemetry;
CREATE POLICY ingest_telemetry_owner_update
ON public.ingest_telemetry FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ingest_telemetry_owner_delete ON public.ingest_telemetry;
CREATE POLICY ingest_telemetry_owner_delete
ON public.ingest_telemetry FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ── Security: onboarding_requests submitter binding ──
-- Replace any insert policy that allowed an unconstrained submitter_user_id
-- with one that requires either NULL (true anon submission) or auth.uid().
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'onboarding_requests'
      AND p.polcmd = 'a' -- INSERT
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.onboarding_requests', pol.polname);
  END LOOP;
END $$;

CREATE POLICY onboarding_requests_anon_insert
ON public.onboarding_requests FOR INSERT TO anon
WITH CHECK (submitter_user_id IS NULL);

CREATE POLICY onboarding_requests_auth_insert
ON public.onboarding_requests FOR INSERT TO authenticated
WITH CHECK (submitter_user_id IS NULL OR submitter_user_id = auth.uid());
