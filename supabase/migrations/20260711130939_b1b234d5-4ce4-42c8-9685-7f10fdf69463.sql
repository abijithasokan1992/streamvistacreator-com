-- 1. mcp_control_flags
CREATE TABLE IF NOT EXISTS public.mcp_control_flags (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mcp_control_flags TO authenticated;
GRANT ALL ON public.mcp_control_flags TO service_role;
ALTER TABLE public.mcp_control_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "MCP control flags founder read" ON public.mcp_control_flags;
CREATE POLICY "MCP control flags founder read"
  ON public.mcp_control_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'::app_role)
      OR public.has_role(auth.uid(), 'platform_owner'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.mcp_control_flags(key, value)
VALUES ('kill_switch', 'true'::jsonb),
       ('logs_window_days', '7'::jsonb),
       ('rate_limit_per_min', '60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Rate-limit buckets
CREATE TABLE IF NOT EXISTS public.mcp_rate_buckets (
  user_id UUID NOT NULL,
  tool TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tool, window_start)
);
CREATE INDEX IF NOT EXISTS mcp_rate_buckets_window_idx
  ON public.mcp_rate_buckets(window_start);
GRANT ALL ON public.mcp_rate_buckets TO service_role;
ALTER TABLE public.mcp_rate_buckets ENABLE ROW LEVEL SECURITY;

-- 3. Extend mcp_audit_log read access to founder/platform_owner
DROP POLICY IF EXISTS "MCP audit founder read" ON public.mcp_audit_log;
CREATE POLICY "MCP audit founder read"
  ON public.mcp_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'::app_role)
      OR public.has_role(auth.uid(), 'platform_owner'::app_role));

-- 4. Role helper
CREATE OR REPLACE FUNCTION public.has_mcp_control_role(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role IN ('founder'::app_role,'platform_owner'::app_role,'super_admin'::app_role)
  );
$$;
REVOKE ALL ON FUNCTION public.has_mcp_control_role(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_mcp_control_role(UUID) TO authenticated, service_role;

-- 5. Kill-switch quick check
CREATE OR REPLACE FUNCTION public.mcp_kill_switch_on()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT (value)::text::boolean FROM public.mcp_control_flags WHERE key='kill_switch'),
    true);
$$;
REVOKE ALL ON FUNCTION public.mcp_kill_switch_on() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_kill_switch_on() TO authenticated, service_role;

-- 6. Rate-limit check
CREATE OR REPLACE FUNCTION public.mcp_check_rate_limit(_user_id UUID, _tool TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _limit INT;
  _window TIMESTAMPTZ := date_trunc('minute', now());
  _current INT;
BEGIN
  IF _user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT COALESCE((value)::text::int, 60) INTO _limit
    FROM public.mcp_control_flags WHERE key='rate_limit_per_min';
  _limit := COALESCE(_limit, 60);

  INSERT INTO public.mcp_rate_buckets(user_id, tool, window_start, count)
    VALUES (_user_id, _tool, _window, 1)
  ON CONFLICT (user_id, tool, window_start)
    DO UPDATE SET count = mcp_rate_buckets.count + 1
  RETURNING count INTO _current;

  DELETE FROM public.mcp_rate_buckets WHERE window_start < now() - interval '15 minutes';
  RETURN _current <= _limit;
END $$;
REVOKE ALL ON FUNCTION public.mcp_check_rate_limit(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_check_rate_limit(UUID, TEXT) TO authenticated;

-- 7. Authorize + audit helper
CREATE OR REPLACE FUNCTION public.mcp_authorize_and_log(
  _tool TEXT,
  _params JSONB DEFAULT '{}'::jsonb,
  _writes BOOLEAN DEFAULT FALSE
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (NULL, _tool, 'mcp_control', FALSE, jsonb_build_object('reason','unauthenticated'));
    RETURN 'forbidden';
  END IF;

  IF NOT public.has_mcp_control_role(_uid) THEN
    INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, _tool, 'mcp_control', FALSE, jsonb_build_object('reason','role_denied'));
    RETURN 'forbidden';
  END IF;

  IF _writes AND public.mcp_kill_switch_on() THEN
    INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, _tool, 'mcp_control', FALSE, jsonb_build_object('reason','kill_switch'));
    RETURN 'kill_switch';
  END IF;

  IF NOT public.mcp_check_rate_limit(_uid, _tool) THEN
    INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
      VALUES (_uid, _tool, 'mcp_control', FALSE, jsonb_build_object('reason','rate_limited'));
    RETURN 'rate_limited';
  END IF;

  INSERT INTO public.mcp_audit_log(actor_user_id, action, resource, allowed, details)
    VALUES (_uid, _tool, 'mcp_control', TRUE, jsonb_build_object('params', _params));
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.mcp_authorize_and_log(TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_authorize_and_log(TEXT, JSONB, BOOLEAN) TO authenticated;

-- 8. Schema introspection (allowlisted, read-only)
CREATE OR REPLACE FUNCTION public.mcp_get_public_schema()
RETURNS TABLE (
  table_name TEXT,
  column_name TEXT,
  data_type TEXT,
  is_nullable TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_mcp_control_role(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT c.table_name::text, c.column_name::text, c.data_type::text, c.is_nullable::text
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     ORDER BY c.table_name, c.ordinal_position;
END $$;
REVOKE ALL ON FUNCTION public.mcp_get_public_schema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_get_public_schema() TO authenticated;

-- 9. Security advisor snapshot (DB-side info only)
CREATE OR REPLACE FUNCTION public.mcp_get_security_advisors()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_mcp_control_role(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'source','db_side',
    'note','Refresh via Supabase linter for the full advisory catalog.',
    'rls_status', (
      SELECT jsonb_agg(jsonb_build_object('table', tablename, 'rls', rowsecurity) ORDER BY tablename)
        FROM pg_tables WHERE schemaname='public'
    )
  );
END $$;
REVOKE ALL ON FUNCTION public.mcp_get_security_advisors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mcp_get_security_advisors() TO authenticated;