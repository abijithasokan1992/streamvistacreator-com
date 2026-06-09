
DO $$ BEGIN
  CREATE TYPE public.studio_slug AS ENUM ('crayons_pictures', 'abhijith_asokan_productions', 'independent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS studio_slug public.studio_slug NOT NULL DEFAULT 'independent';

UPDATE public.user_profiles
SET studio_slug = CASE
  WHEN lower(coalesce(studio_name,'')) LIKE '%crayons%pictures%' THEN 'crayons_pictures'::public.studio_slug
  WHEN lower(coalesce(studio_name,'')) LIKE '%abhijith%' OR lower(coalesce(studio_name,'')) LIKE '%abijith%' THEN 'abhijith_asokan_productions'::public.studio_slug
  ELSE 'independent'::public.studio_slug
END
WHERE studio_slug = 'independent';

CREATE INDEX IF NOT EXISTS user_profiles_studio_slug_idx ON public.user_profiles(studio_slug);
