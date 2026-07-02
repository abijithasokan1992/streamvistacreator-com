UPDATE public.studio_vault_products
SET sell_price_per_tb_paise = 65000,
    default_tb_options = '[1]'::jsonb,
    billing_modes = '["monthly"]'::jsonb,
    min_tb = 1,
    max_tb = 10,
    badge = 'Live',
    name = '1 TB Studio Storage',
    short_pitch = 'Secure recurring vault storage for studio uploads, working media, masters and archive copies.'
WHERE storage_class = 'active_vault';