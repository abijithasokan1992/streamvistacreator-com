
DO $$ BEGIN
  CREATE TYPE public.agent_surface AS ENUM ('home','creator','studio','buyer','chief');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.agent_severity AS ENUM ('info','warn','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent public.agent_surface NOT NULL,
  severity public.agent_severity NOT NULL DEFAULT 'info',
  title text NOT NULL,
  summary text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agent_events TO authenticated;
GRANT ALL ON public.agent_events TO service_role;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read all agent events"
  ON public.agent_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Users read their own agent events"
  ON public.agent_events FOR SELECT TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users insert their own agent events"
  ON public.agent_events FOR INSERT TO authenticated
  WITH CHECK (created_by IS NULL OR created_by = auth.uid());

CREATE INDEX IF NOT EXISTS agent_events_created_at_idx ON public.agent_events (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_events_agent_idx ON public.agent_events (agent, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_events;
ALTER TABLE public.agent_events REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.agent_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  audio_base64 text,
  event_window_start timestamptz,
  event_window_end timestamptz,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agent_reports TO authenticated;
GRANT ALL ON public.agent_reports TO service_role;
ALTER TABLE public.agent_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read agent reports"
  ON public.agent_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders insert agent reports"
  ON public.agent_reports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'founder'));
