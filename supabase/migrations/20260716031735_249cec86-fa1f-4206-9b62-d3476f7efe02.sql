update public.site_config
set extra_origins = (
  select array_agg(distinct o)
  from unnest(coalesce(extra_origins, ARRAY[]::text[]) || ARRAY[
    'https://id-preview--6efc82ec-bd50-4b3a-90ba-234ec4d1014c.lovable.app',
    'https://6efc82ec-bd50-4b3a-90ba-234ec4d1014c.lovableproject.com',
    'https://preview--streamvista-creator.lovable.app'
  ]) as t(o)
)
where id = true;