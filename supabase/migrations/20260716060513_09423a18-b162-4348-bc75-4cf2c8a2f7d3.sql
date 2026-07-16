
-- 1. partner_title_matches
DROP POLICY IF EXISTS "Owners insert own matches" ON public.partner_title_matches;
DROP POLICY IF EXISTS "Owners update own matches" ON public.partner_title_matches;

CREATE POLICY "Owners insert own matches"
  ON public.partner_title_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct
      WHERE ct.id = partner_title_matches.title_id AND ct.owner_user_id = auth.uid())
  );

CREATE POLICY "Owners update own matches"
  ON public.partner_title_matches
  FOR UPDATE TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct
      WHERE ct.id = partner_title_matches.title_id AND ct.owner_user_id = auth.uid())
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct
      WHERE ct.id = partner_title_matches.title_id AND ct.owner_user_id = auth.uid())
  );

-- 2. title_ai_licensing
DROP POLICY IF EXISTS ai_lic_owner_insert ON public.title_ai_licensing;
DROP POLICY IF EXISTS ai_lic_owner_update ON public.title_ai_licensing;

CREATE POLICY ai_lic_owner_insert
  ON public.title_ai_licensing
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct
      WHERE ct.id = title_ai_licensing.title_id AND ct.owner_user_id = auth.uid())
  );

CREATE POLICY ai_lic_owner_update
  ON public.title_ai_licensing
  FOR UPDATE TO authenticated
  USING (
    (owner_user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.content_titles ct
       WHERE ct.id = title_ai_licensing.title_id AND ct.owner_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (owner_user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.content_titles ct
       WHERE ct.id = title_ai_licensing.title_id AND ct.owner_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. title_ai_licensing_documents
DROP POLICY IF EXISTS ai_docs_owner_insert ON public.title_ai_licensing_documents;
DROP POLICY IF EXISTS ai_docs_owner_update ON public.title_ai_licensing_documents;
DROP POLICY IF EXISTS ai_docs_owner_delete ON public.title_ai_licensing_documents;

CREATE POLICY ai_docs_owner_insert
  ON public.title_ai_licensing_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct
      WHERE ct.id = title_ai_licensing_documents.title_id AND ct.owner_user_id = auth.uid())
  );

CREATE POLICY ai_docs_owner_update
  ON public.title_ai_licensing_documents
  FOR UPDATE TO authenticated
  USING (
    (owner_user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.content_titles ct
       WHERE ct.id = title_ai_licensing_documents.title_id AND ct.owner_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (owner_user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.content_titles ct
       WHERE ct.id = title_ai_licensing_documents.title_id AND ct.owner_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY ai_docs_owner_delete
  ON public.title_ai_licensing_documents
  FOR DELETE TO authenticated
  USING (
    (owner_user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.content_titles ct
       WHERE ct.id = title_ai_licensing_documents.title_id AND ct.owner_user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 4. billing_orders: grants + defense-in-depth trigger
REVOKE ALL ON public.billing_orders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.billing_orders FROM authenticated;
GRANT SELECT ON public.billing_orders TO authenticated;
GRANT ALL ON public.billing_orders TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_billing_orders_write_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF jwt_role IS NOT NULL
     AND jwt_role <> 'service_role'
     AND NOT has_role(auth.uid(), 'admin'::app_role)
     AND NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'billing_orders writes are restricted to validated payment functions';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_billing_orders_write_scope ON public.billing_orders;
CREATE TRIGGER trg_enforce_billing_orders_write_scope
  BEFORE INSERT OR UPDATE OR DELETE ON public.billing_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_orders_write_scope();

-- 5. billing_payment_method_configs — no anon
REVOKE ALL ON public.billing_payment_method_configs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_payment_method_configs TO authenticated;
GRANT ALL ON public.billing_payment_method_configs TO service_role;

-- 6. billing_manual_payment_submissions — no anon
REVOKE ALL ON public.billing_manual_payment_submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_manual_payment_submissions TO authenticated;
GRANT ALL ON public.billing_manual_payment_submissions TO service_role;

-- 7. asset_metadata / asset_versions / deliverables — no anon
REVOKE ALL ON public.asset_metadata FROM anon;
REVOKE ALL ON public.asset_versions FROM anon;
REVOKE ALL ON public.deliverables   FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_metadata TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverables   TO authenticated;
GRANT ALL ON public.asset_metadata TO service_role;
GRANT ALL ON public.asset_versions TO service_role;
GRANT ALL ON public.deliverables   TO service_role;
