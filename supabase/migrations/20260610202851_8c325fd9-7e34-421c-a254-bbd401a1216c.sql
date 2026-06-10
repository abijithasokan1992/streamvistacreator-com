
-- MCP Audit Log: records every AI agent action requested via the app
CREATE TABLE IF NOT EXISTS public.mcp_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  permission_key TEXT,
  allowed BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.mcp_audit_log TO authenticated;
GRANT ALL ON public.mcp_audit_log TO service_role;

ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read MCP audit log"
  ON public.mcp_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert MCP audit entries"
  ON public.mcp_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS mcp_audit_log_created_at_idx ON public.mcp_audit_log(created_at DESC);

-- Seed default MCP permissions row in admin_settings (admin-only governed)
INSERT INTO public.admin_settings (key, value)
VALUES (
  'mcp_permissions',
  jsonb_build_object(
    'allow_db_read', true,
    'allow_db_write', false,
    'allow_storage_read', true,
    'allow_storage_write', false,
    'allow_edge_invoke', true,
    'allow_user_data_export', false,
    'master_kill_switch', false,
    'updated_at', now()
  )
)
ON CONFLICT (key) DO NOTHING;
