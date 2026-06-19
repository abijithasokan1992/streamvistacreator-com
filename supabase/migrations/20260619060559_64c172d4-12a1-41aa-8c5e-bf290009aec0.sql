UPDATE public.site_config
SET extra_origins = ARRAY[
  'https://www.streamvistacreator.com',
  'https://app.crayonspictures.com',
  'https://https-app-crayonspictures-com.lovable.app',
  'https://id-preview--6efc82ec-bd50-4b3a-90ba-234ec4d1014c.lovable.app'
]::text[],
updated_at = now()
WHERE id = true;