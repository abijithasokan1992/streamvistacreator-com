DROP POLICY IF EXISTS svp_public_read_visible ON public.studio_vault_products;

CREATE POLICY svp_public_read_visible ON public.studio_vault_products
  FOR SELECT TO anon, authenticated
  USING (visible = true AND self_serve_enabled = true);

REVOKE SELECT ON public.studio_vault_products FROM anon, authenticated;
GRANT SELECT (
  id,
  code,
  name,
  storage_class,
  description,
  short_pitch,
  badge,
  sell_price_per_tb_paise,
  gst_percent,
  min_tb,
  max_tb,
  default_tb_options,
  billing_modes,
  features,
  visible,
  self_serve_enabled,
  enterprise_only,
  oci_storage_tier,
  sort_order,
  created_at,
  updated_at
) ON public.studio_vault_products TO anon, authenticated;
GRANT ALL ON public.studio_vault_products TO service_role;

CREATE OR REPLACE VIEW public.studio_vault_products_public
WITH (security_invoker = true) AS
SELECT
  id,
  code,
  name,
  storage_class,
  description,
  short_pitch,
  badge,
  sell_price_per_tb_paise,
  gst_percent,
  min_tb,
  max_tb,
  default_tb_options,
  billing_modes,
  features,
  visible,
  self_serve_enabled,
  enterprise_only,
  oci_storage_tier,
  sort_order,
  created_at,
  updated_at
FROM public.studio_vault_products
WHERE visible = true AND self_serve_enabled = true;

GRANT SELECT ON public.studio_vault_products_public TO anon, authenticated;