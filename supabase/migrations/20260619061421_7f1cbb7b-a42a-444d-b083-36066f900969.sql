DROP POLICY IF EXISTS "Anyone can read branding" ON public.branding_settings;
CREATE POLICY "Authenticated can read branding"
  ON public.branding_settings
  FOR SELECT
  TO authenticated
  USING (true);
REVOKE SELECT ON public.branding_settings FROM anon;