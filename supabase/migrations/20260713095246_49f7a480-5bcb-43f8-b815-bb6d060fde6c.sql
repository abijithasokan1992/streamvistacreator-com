UPDATE public.site_config
   SET primary_domain = 'https://streamvista.in',
       extra_origins  = ARRAY[
         'https://www.streamvista.in',
         'https://app.streamvista.in',
         'https://admin.streamvista.in',
         'https://auth.streamvista.in',
         'https://streamvistacreator.com',
         'https://www.streamvistacreator.com',
         'https://streamvista-creator.lovable.app'
       ]
 WHERE id = TRUE;