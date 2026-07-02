
-- billing-proofs: per-user owned proofs at path `<user_id>/<order_id>/<file>`
DROP POLICY IF EXISTS "billing_proofs_owner_insert" ON storage.objects;
CREATE POLICY "billing_proofs_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'billing-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "billing_proofs_owner_select" ON storage.objects;
CREATE POLICY "billing_proofs_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'billing-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "billing_proofs_owner_delete" ON storage.objects;
CREATE POLICY "billing_proofs_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'billing-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
  );

DROP POLICY IF EXISTS "billing_proofs_admin_update" ON storage.objects;
CREATE POLICY "billing_proofs_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'billing-proofs'
    AND (public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
  );
