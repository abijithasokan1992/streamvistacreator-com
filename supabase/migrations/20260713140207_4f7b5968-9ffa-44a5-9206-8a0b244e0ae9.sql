CREATE POLICY "ai_rights_docs_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'title-ai-rights-docs'
         AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));

CREATE POLICY "ai_rights_docs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'title-ai-rights-docs' AND owner = auth.uid());

CREATE POLICY "ai_rights_docs_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'title-ai-rights-docs'
         AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)));
