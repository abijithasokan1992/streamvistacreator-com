
-- 1) Branding: restrict direct table reads to admins only
DROP POLICY IF EXISTS "Authenticated can read branding" ON public.branding_settings;

-- Public read helper that exposes only non-sensitive display fields, singleton row
CREATE OR REPLACE FUNCTION public.get_active_branding()
RETURNS TABLE (
  id uuid,
  site_logo_url text,
  site_logo_position text,
  footer_logo_url text,
  footer_logo_position text,
  show_wordmark boolean,
  allow_user_logos boolean,
  user_logos_paid_only boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.site_logo_url, b.site_logo_position, b.footer_logo_url,
         b.footer_logo_position, b.show_wordmark, b.allow_user_logos,
         b.user_logos_paid_only
  FROM public.branding_settings b
  ORDER BY b.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_active_branding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_branding() TO anon, authenticated;

-- 2) Screening events: document that writes flow through SECURITY DEFINER RPC
COMMENT ON POLICY "screening_events_admin_insert" ON public.screening_events IS
  'Direct inserts restricted to admins. Anonymous and authenticated screening progress events are written exclusively via public.screening_log_event (SECURITY DEFINER), which validates the invite token before inserting.';
