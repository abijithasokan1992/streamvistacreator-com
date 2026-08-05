CREATE TABLE public.deployment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  provider text NOT NULL DEFAULT 'vercel',
  project_id text,
  deployment_id text,
  target_label text,
  before_state jsonb,
  after_state jsonb,
  result text NOT NULL DEFAULT 'pending',
  error_summary text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.deployment_audit_log TO authenticated;
GRANT ALL ON public.deployment_audit_log TO service_role;

ALTER TABLE public.deployment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deployment audit log"
ON public.deployment_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX idx_deployment_audit_log_created_at ON public.deployment_audit_log (created_at DESC);