
-- 1) shared_files: column-level lockdown on password material
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM authenticated;
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM anon;
-- service_role keeps full access via existing GRANT ALL

-- 2) partner_logos: only active rows are public
DROP POLICY IF EXISTS "Public can read active partner logos" ON public.partner_logos;
CREATE POLICY "Public can read active partner logos"
  ON public.partner_logos
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
