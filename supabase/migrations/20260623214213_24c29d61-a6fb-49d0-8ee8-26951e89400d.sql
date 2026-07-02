
CREATE OR REPLACE FUNCTION public.tg_homepage_hero_reel_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE IF NOT EXISTS public.homepage_hero_reel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  poster_url text,
  backdrop_url text,
  image_url text,
  cta_label text,
  cta_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.homepage_hero_reel TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_hero_reel TO authenticated;
GRANT ALL ON public.homepage_hero_reel TO service_role;

ALTER TABLE public.homepage_hero_reel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published active hero reel"
  ON public.homepage_hero_reel FOR SELECT
  USING (
    is_active = true AND status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Admins can view all hero reel"
  ON public.homepage_hero_reel FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can insert hero reel"
  ON public.homepage_hero_reel FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can update hero reel"
  ON public.homepage_hero_reel FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can delete hero reel"
  ON public.homepage_hero_reel FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER homepage_hero_reel_set_updated_at
  BEFORE UPDATE ON public.homepage_hero_reel
  FOR EACH ROW EXECUTE FUNCTION public.tg_homepage_hero_reel_set_updated_at();

CREATE INDEX IF NOT EXISTS homepage_hero_reel_active_sort_idx
  ON public.homepage_hero_reel (is_active, status, sort_order);
