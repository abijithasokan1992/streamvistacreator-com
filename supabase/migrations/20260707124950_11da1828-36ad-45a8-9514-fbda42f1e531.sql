
-- 1) agent_events: add restrictive INSERT/UPDATE/DELETE policies denying all client writes.
--    Service role bypasses RLS, so edge functions using SERVICE_ROLE_KEY continue to work.
DROP POLICY IF EXISTS "Block client inserts on agent_events" ON public.agent_events;
CREATE POLICY "Block client inserts on agent_events"
  ON public.agent_events FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client updates on agent_events" ON public.agent_events;
CREATE POLICY "Block client updates on agent_events"
  ON public.agent_events FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block client deletes on agent_events" ON public.agent_events;
CREATE POLICY "Block client deletes on agent_events"
  ON public.agent_events FOR DELETE TO authenticated, anon
  USING (false);

-- 2) ingest_alert_events: fix swapped-argument is_workspace_admin call.
--    Function signature is is_workspace_admin(_workspace_id, _user_id).
DROP POLICY IF EXISTS "members read alert events" ON public.ingest_alert_events;
CREATE POLICY "members read alert events"
  ON public.ingest_alert_events FOR SELECT TO authenticated
  USING (
    is_workspace_admin(workspace_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ingest_alert_events.workspace_id
        AND wm.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) payment_traces: scope owner SELECT policy to authenticated only, and block client writes.
DROP POLICY IF EXISTS "Users read their own payment traces" ON public.payment_traces;
CREATE POLICY "Users read their own payment traces"
  ON public.payment_traces FOR SELECT TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Block client inserts on payment_traces" ON public.payment_traces;
CREATE POLICY "Block client inserts on payment_traces"
  ON public.payment_traces FOR INSERT TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "Block client updates on payment_traces" ON public.payment_traces;
CREATE POLICY "Block client updates on payment_traces"
  ON public.payment_traces FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block client deletes on payment_traces" ON public.payment_traces;
CREATE POLICY "Block client deletes on payment_traces"
  ON public.payment_traces FOR DELETE TO authenticated, anon
  USING (false);
