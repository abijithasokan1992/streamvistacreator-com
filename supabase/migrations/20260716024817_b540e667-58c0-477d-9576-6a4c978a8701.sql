
DROP POLICY IF EXISTS "moa insert self" ON public.managed_ops_audit;

CREATE POLICY "moa insert authorized"
ON public.managed_ops_audit
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'managed_ops_lead'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.managed_project_permissions mpp
      WHERE mpp.content_title_id = managed_ops_audit.content_title_id
        AND mpp.operator_id = auth.uid()
        AND mpp.revoked_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.content_titles ct
      WHERE ct.id = managed_ops_audit.content_title_id
        AND ct.owner_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "ai_audit_self_insert" ON public.ai_licensing_audit_log;

CREATE POLICY "ai_audit_authorized_insert"
ON public.ai_licensing_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      entity_type = 'title_ai_licensing'
      AND EXISTS (
        SELECT 1 FROM public.title_ai_licensing tal
        WHERE tal.id = ai_licensing_audit_log.entity_id
          AND tal.owner_user_id = auth.uid()
      )
    )
    OR (
      entity_type = 'content_title'
      AND EXISTS (
        SELECT 1 FROM public.content_titles ct
        WHERE ct.id = ai_licensing_audit_log.entity_id
          AND ct.owner_user_id = auth.uid()
      )
    )
    OR (
      entity_type = 'ai_buyer_requirement'
      AND EXISTS (
        SELECT 1 FROM public.ai_buyer_requirements abr
        WHERE abr.id = ai_licensing_audit_log.entity_id
          AND abr.submitted_by = auth.uid()
      )
    )
  )
);
