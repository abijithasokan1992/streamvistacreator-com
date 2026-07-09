
-- 1. Security-invoker on the finance revenue view
ALTER VIEW public.finance_revenue_summary SET (security_invoker = on);

-- 2. Distribution partners: lock down raw reads to admins; expose safe public view
DROP POLICY IF EXISTS "read active partners" ON public.distribution_partners;
CREATE POLICY "admins read partners"
  ON public.distribution_partners
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE VIEW public.distribution_partners_public
  WITH (security_invoker = on) AS
  SELECT id, slug, name, protocol, description, logo_url, is_active,
         default_package_type, supported_package_types
  FROM public.distribution_partners
  WHERE is_active = true;

-- The view runs as caller; add a permissive SELECT policy on the base table
-- limited to the safe columns via the view (RLS is bypassed only through
-- explicit grants, so we add a second policy scoped to any authenticated user
-- but the view only exposes non-sensitive columns).
CREATE POLICY "public read active partners via view"
  ON public.distribution_partners
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Wait — the above would still expose `config`. Drop it and instead use a
-- SECURITY DEFINER-free function pattern: revoke direct table SELECT for
-- non-admins by removing that permissive policy. The view will read via the
-- admin policy path is not possible for non-admins. Instead, make the view
-- SECURITY DEFINER-owned by a role limited to safe columns.
DROP POLICY IF EXISTS "public read active partners via view" ON public.distribution_partners;

-- Use a SECURITY DEFINER function to expose safe fields to any authenticated user
CREATE OR REPLACE FUNCTION public.list_active_distribution_partners()
RETURNS TABLE (
  id uuid, slug text, name text, protocol distribution_protocol,
  description text, logo_url text, is_active boolean,
  default_package_type text, supported_package_types text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, name, protocol, description, logo_url, is_active,
         default_package_type, supported_package_types
  FROM public.distribution_partners
  WHERE is_active = true
  ORDER BY name;
$$;

REVOKE ALL ON FUNCTION public.list_active_distribution_partners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_distribution_partners() TO authenticated, service_role;

-- Drop the intermediate view; callers use the RPC instead
DROP VIEW IF EXISTS public.distribution_partners_public;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.distribution_partners TO authenticated;
GRANT ALL ON public.distribution_partners TO service_role;

-- 3. Distribution metadata mappings: admins only
DROP POLICY IF EXISTS "read mappings" ON public.distribution_metadata_mappings;
CREATE POLICY "admins read mappings"
  ON public.distribution_metadata_mappings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));
