DROP POLICY IF EXISTS svp_public_read_visible ON public.studio_vault_products;
REVOKE SELECT ON public.studio_vault_products FROM anon;
-- Authenticated still has SELECT, but RLS now restricts non-admin reads to zero rows.
-- Public catalog reads continue via the public.studio_vault_products_public view, which omits internal_cost_per_tb_paise.