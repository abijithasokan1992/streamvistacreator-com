CREATE OR REPLACE VIEW public.studio_vault_products_public AS
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
WHERE visible = true;

GRANT SELECT ON public.studio_vault_products_public TO anon, authenticated;

UPDATE public.studio_vault_products
SET
  name = '1 TB Studio Storage',
  sell_price_per_tb_paise = 65000,
  gst_percent = 18,
  min_tb = 1,
  max_tb = 10,
  default_tb_options = '[1]'::jsonb,
  billing_modes = '["monthly"]'::jsonb,
  visible = true,
  self_serve_enabled = true,
  enterprise_only = false,
  badge = 'Live',
  short_pitch = 'Secure recurring vault storage for studio uploads, working media, masters and archive copies.',
  sort_order = 10,
  updated_at = now()
WHERE storage_class = 'active_vault';