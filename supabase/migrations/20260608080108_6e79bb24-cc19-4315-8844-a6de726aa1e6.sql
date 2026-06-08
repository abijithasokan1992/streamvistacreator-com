
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- Storage policies for branding bucket
CREATE POLICY "Public read branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Admins manage site branding" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'branding' AND (name LIKE 'site/%' OR name LIKE 'footer/%') AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'branding' AND (name LIKE 'site/%' OR name LIKE 'footer/%') AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users manage own brand logo" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'branding' AND name LIKE ('users/' || auth.uid()::text || '/%'))
  WITH CHECK (bucket_id = 'branding' AND name LIKE ('users/' || auth.uid()::text || '/%'));
