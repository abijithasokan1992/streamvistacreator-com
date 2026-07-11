-- Restrict public exposure of partner_profiles.contact_email
-- 1) Drop the permissive public SELECT policy on the base table (admins retain full access).
DROP POLICY IF EXISTS "Public reads published channel partners" ON public.partner_profiles;

-- 2) Create a public-safe view that excludes contact_email.
CREATE OR REPLACE VIEW public.partner_profiles_public
WITH (security_invoker = false) AS
SELECT
  id, organization_id, slug, name, tagline, description, logo_url, website_url,
  hero_image_url, is_active, is_featured, sort_order, categories,
  submission_requirements, licensing_models, territories, languages,
  content_preferences, runtime_min_minutes, runtime_max_minutes, min_resolution,
  audio_requirements, subtitle_requirements, exclusivity, revenue_share_notes,
  deal_timeline_days, created_at, updated_at
FROM public.partner_profiles p
WHERE p.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p.organization_id
      AND o.org_kind = 'channel_partner'::org_kind
      AND o.published = true
      AND o.status = 'active'::org_status
  );

GRANT SELECT ON public.partner_profiles_public TO anon, authenticated;

COMMENT ON VIEW public.partner_profiles_public IS
  'Public-safe partner directory view. Excludes contact_email (admin-only via base table).';
