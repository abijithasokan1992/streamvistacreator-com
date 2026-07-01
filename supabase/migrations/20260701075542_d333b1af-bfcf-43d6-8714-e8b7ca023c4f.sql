
-- Fix argument order in ingest_alert_rules policies (workspace_id, user_id)
DROP POLICY IF EXISTS "alert rules delete" ON public.ingest_alert_rules;
DROP POLICY IF EXISTS "alert rules insert premium" ON public.ingest_alert_rules;
DROP POLICY IF EXISTS "alert rules read" ON public.ingest_alert_rules;
DROP POLICY IF EXISTS "alert rules update premium" ON public.ingest_alert_rules;

CREATE POLICY "alert rules read" ON public.ingest_alert_rules
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_workspace_admin(workspace_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = ingest_alert_rules.workspace_id
      AND wm.user_id = auth.uid()
  )
);

CREATE POLICY "alert rules insert premium" ON public.ingest_alert_rules
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_workspace_admin(workspace_id, auth.uid()) AND has_premium_storage_entitlement(auth.uid()))
);

CREATE POLICY "alert rules update premium" ON public.ingest_alert_rules
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_workspace_admin(workspace_id, auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_workspace_admin(workspace_id, auth.uid()) AND has_premium_storage_entitlement(auth.uid()))
);

CREATE POLICY "alert rules delete" ON public.ingest_alert_rules
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_workspace_admin(workspace_id, auth.uid())
);

-- Add owner-scoped SELECT policy for payment_traces
CREATE POLICY "Users read their own payment traces" ON public.payment_traces
FOR SELECT
USING (user_id = auth.uid());
