UPDATE public.site_config
SET primary_domain = 'https://www.streamvistacreator.com'
WHERE id = TRUE
  AND (
    primary_domain IS NULL
    OR primary_domain IN (
      '',
      'https://app.crayonspictures.com',
      'https://www.app.crayonspictures.com',
      'https://https-app-crayonspictures-com.lovable.app'
    )
  );

UPDATE public.site_config
SET extra_origins = ARRAY(
  SELECT DISTINCT o FROM unnest(
    COALESCE(extra_origins, ARRAY[]::text[]) || ARRAY[
      'https://streamvistacreator.com',
      'https://streamvista-creator.lovable.app'
    ]
  ) AS o
  WHERE o NOT IN (
    'https://app.crayonspictures.com',
    'https://www.app.crayonspictures.com',
    'https://https-app-crayonspictures-com.lovable.app'
  )
)
WHERE id = TRUE;