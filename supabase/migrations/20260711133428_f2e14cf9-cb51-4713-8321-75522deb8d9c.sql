
CREATE POLICY "DIT screenshots: users can read own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND owner = auth.uid());

CREATE POLICY "DIT screenshots: users can upload own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dit-ingest-screenshots' AND owner = auth.uid() AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "DIT screenshots: users can update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'dit-ingest-screenshots' AND owner = auth.uid());

CREATE POLICY "DIT screenshots: users can delete own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND owner = auth.uid());
