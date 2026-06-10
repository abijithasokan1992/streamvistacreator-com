INSERT INTO public.site_config (id, primary_domain, extra_origins)
VALUES (true, 'https://app.crayonspictures.com', ARRAY['https://app.crayonspictures.com','https://crayonspictures.com','https://www.crayonspictures.com'])
ON CONFLICT (id) DO UPDATE
SET primary_domain = EXCLUDED.primary_domain,
    extra_origins = (
      SELECT ARRAY(SELECT DISTINCT unnest(EXCLUDED.extra_origins || COALESCE(public.site_config.extra_origins, ARRAY[]::text[])))
    ),
    updated_at = now();