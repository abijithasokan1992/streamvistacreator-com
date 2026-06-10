
-- ============ helper: updated_at trigger reused ============
-- public.touch_updated_at already exists.

-- ============ ad_zones slot enum (text check) ============

-- 1) hero_banners
CREATE TABLE public.hero_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL,
  subheadline text,
  image_url text,
  cta_label text,
  cta_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hero_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_banners TO authenticated;
GRANT ALL ON public.hero_banners TO service_role;
ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live hero banners" ON public.hero_banners
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));
CREATE POLICY "Admins manage hero banners" ON public.hero_banners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER hero_banners_touch BEFORE UPDATE ON public.hero_banners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) ad_zones
CREATE TABLE public.ad_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('top','mid','bottom')),
  title text NOT NULL,
  image_url text,
  link_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ad_zones TO authenticated;
GRANT ALL ON public.ad_zones TO service_role;
ALTER TABLE public.ad_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live ad zones" ON public.ad_zones
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));
CREATE POLICY "Admins manage ad zones" ON public.ad_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ad_zones_touch BEFORE UPDATE ON public.ad_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) featured_films
CREATE TABLE public.featured_films (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  blurb text,
  poster_url text,
  link_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_films TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.featured_films TO authenticated;
GRANT ALL ON public.featured_films TO service_role;
ALTER TABLE public.featured_films ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live featured films" ON public.featured_films
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));
CREATE POLICY "Admins manage featured films" ON public.featured_films
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER featured_films_touch BEFORE UPDATE ON public.featured_films
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) news_events
CREATE TABLE public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('news','event')),
  title text NOT NULL,
  summary text,
  image_url text,
  link_url text,
  event_date timestamptz,
  location text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_events TO authenticated;
GRANT ALL ON public.news_events TO service_role;
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live news/events" ON public.news_events
  FOR SELECT TO anon, authenticated
  USING (is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at   IS NULL OR ends_at   >  now()));
CREATE POLICY "Admins manage news/events" ON public.news_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER news_events_touch BEFORE UPDATE ON public.news_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ storage policies for `marketing` bucket ============
CREATE POLICY "Public read marketing bucket" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'marketing');
CREATE POLICY "Admins upload marketing files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update marketing files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete marketing files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'marketing' AND public.has_role(auth.uid(), 'admin'));
