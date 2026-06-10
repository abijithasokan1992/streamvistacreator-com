
-- Add status column to all 4 CMS tables
ALTER TABLE public.hero_banners   ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'));
ALTER TABLE public.ad_zones       ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'));
ALTER TABLE public.featured_films ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'));
ALTER TABLE public.news_events    ADD COLUMN status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'));

-- Backfill any existing rows so they don't suddenly disappear
UPDATE public.hero_banners   SET status = 'published' WHERE status = 'draft';
UPDATE public.ad_zones       SET status = 'published' WHERE status = 'draft';
UPDATE public.featured_films SET status = 'published' WHERE status = 'draft';
UPDATE public.news_events    SET status = 'published' WHERE status = 'draft';

-- Replace public SELECT policies to require status = 'published'
DROP POLICY IF EXISTS "Public can view live hero banners"   ON public.hero_banners;
DROP POLICY IF EXISTS "Public can view live ad zones"       ON public.ad_zones;
DROP POLICY IF EXISTS "Public can view live featured films" ON public.featured_films;
DROP POLICY IF EXISTS "Public can view live news/events"    ON public.news_events;

CREATE POLICY "Public can view live hero banners" ON public.hero_banners
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));

CREATE POLICY "Public can view live ad zones" ON public.ad_zones
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));

CREATE POLICY "Public can view live featured films" ON public.featured_films
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));

CREATE POLICY "Public can view live news/events" ON public.news_events
  FOR SELECT TO anon, authenticated
  USING (status = 'published' AND is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));

-- Admins still see / manage everything via the existing "Admins manage ..." policies.
