
ALTER TABLE public.hero_banners
  ADD COLUMN IF NOT EXISTS internal_label text,
  ADD COLUMN IF NOT EXISTS cta2_label text,
  ADD COLUMN IF NOT EXISTS cta2_url text;

ALTER TABLE public.featured_films
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS partner text;
