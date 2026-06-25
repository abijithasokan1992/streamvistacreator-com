
CREATE TABLE public.homepage_hero_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  mode text NOT NULL DEFAULT 'single' CHECK (mode IN ('single','slider')),
  autoplay boolean NOT NULL DEFAULT true,
  interval_ms integer NOT NULL DEFAULT 5000 CHECK (interval_ms >= 1500 AND interval_ms <= 60000),
  transition text NOT NULL DEFAULT 'fade' CHECK (transition IN ('fade')),
  pause_on_hover boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.homepage_hero_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.homepage_hero_settings TO authenticated;
GRANT ALL ON public.homepage_hero_settings TO service_role;

ALTER TABLE public.homepage_hero_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hero settings"
  ON public.homepage_hero_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert hero settings"
  ON public.homepage_hero_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hero settings"
  ON public.homepage_hero_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.homepage_hero_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
