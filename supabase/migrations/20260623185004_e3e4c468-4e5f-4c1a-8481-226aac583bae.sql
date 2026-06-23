UPDATE public.site_config
SET primary_domain = 'https://streamvistacreator.com',
    extra_origins = ARRAY['https://www.streamvistacreator.com', 'https://streamvista-creator.lovable.app']
WHERE id = TRUE;