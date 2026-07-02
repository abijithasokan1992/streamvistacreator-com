
-- Fix function search_path
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Remove permissive testing_storage_override read policy; admins already covered by ps_admin_read/ps_super_all,
-- and SECURITY DEFINER functions read it server-side.
DROP POLICY IF EXISTS "ps_testing_override_read" ON public.platform_settings;

-- Scope branding_settings reads to non-sensitive UI columns via column-level GRANTs.
-- Excludes updated_by (admin user id). Policy remains permissive for authenticated UI use.
REVOKE SELECT ON public.branding_settings FROM authenticated;
GRANT SELECT (id, site_logo_url, site_logo_position, footer_logo_url, footer_logo_position,
              show_wordmark, allow_user_logos, user_logos_paid_only, created_at, updated_at)
  ON public.branding_settings TO authenticated;
