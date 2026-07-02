
-- Ingest alerting: rules + fired events
CREATE TABLE public.ingest_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('connection_drop','error_spike','low_throughput')),
  enabled boolean NOT NULL DEFAULT true,
  -- threshold shape per rule_type:
  --   connection_drop: { paused_minutes: int, failed_pct: int }
  --   error_spike:     { failed_pct: int, window_minutes: int, min_jobs: int }
  --   low_throughput:  { min_bytes_per_sec: bigint, window_minutes: int, min_jobs: int }
  threshold jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  recipients jsonb NOT NULL DEFAULT '{"emails":[],"phones":[]}'::jsonb,
  cooldown_minutes int NOT NULL DEFAULT 30,
  last_fired_at timestamptz,
  last_evaluated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ingest_alert_rules_workspace_idx ON public.ingest_alert_rules(workspace_id) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_alert_rules TO authenticated;
GRANT ALL ON public.ingest_alert_rules TO service_role;

ALTER TABLE public.ingest_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read alert rules"
  ON public.ingest_alert_rules FOR SELECT TO authenticated
  USING (
    public.is_workspace_admin(auth.uid(), workspace_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm
               WHERE wm.workspace_id = ingest_alert_rules.workspace_id AND wm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "admins manage alert rules"
  ON public.ingest_alert_rules FOR ALL TO authenticated
  USING (
    public.is_workspace_admin(auth.uid(), workspace_id)
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_workspace_admin(auth.uid(), workspace_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER tg_ingest_alert_rules_updated
  BEFORE UPDATE ON public.ingest_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_ingest_pipeline_set_updated_at();

-- Append-only fired events for audit + dedupe
CREATE TABLE public.ingest_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.ingest_alert_rules(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels_attempted text[] NOT NULL DEFAULT ARRAY[]::text[],
  delivery_status jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ingest_alert_events_workspace_idx ON public.ingest_alert_events(workspace_id, fired_at DESC);
CREATE INDEX ingest_alert_events_rule_idx ON public.ingest_alert_events(rule_id, fired_at DESC);

GRANT SELECT ON public.ingest_alert_events TO authenticated;
GRANT ALL ON public.ingest_alert_events TO service_role;

ALTER TABLE public.ingest_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read alert events"
  ON public.ingest_alert_events FOR SELECT TO authenticated
  USING (
    public.is_workspace_admin(auth.uid(), workspace_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm
               WHERE wm.workspace_id = ingest_alert_events.workspace_id AND wm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
