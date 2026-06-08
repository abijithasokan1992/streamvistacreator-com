
-- Partner logos table (public read, admin write)
CREATE TABLE public.partner_logos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_logos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_logos TO authenticated;
GRANT ALL ON public.partner_logos TO service_role;
ALTER TABLE public.partner_logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active partner logos" ON public.partner_logos FOR SELECT USING (true);
CREATE POLICY "Admins insert partner logos" ON public.partner_logos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update partner logos" ON public.partner_logos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete partner logos" ON public.partner_logos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE TRIGGER partner_logos_touch_updated_at BEFORE UPDATE ON public.partner_logos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Singleton settings table (public read, admin write)
CREATE TABLE public.partner_logos_settings (
  id BOOLEAN NOT NULL PRIMARY KEY DEFAULT true CHECK (id = true),
  aspect_ratio TEXT NOT NULL DEFAULT '16/9',
  object_fit TEXT NOT NULL DEFAULT 'contain',
  container_bg TEXT NOT NULL DEFAULT '#ffffff',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_logos_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.partner_logos_settings TO authenticated;
GRANT ALL ON public.partner_logos_settings TO service_role;
ALTER TABLE public.partner_logos_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read partner logo settings" ON public.partner_logos_settings FOR SELECT USING (true);
CREATE POLICY "Admins insert partner logo settings" ON public.partner_logos_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update partner logo settings" ON public.partner_logos_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE TRIGGER partner_logos_settings_touch_updated_at BEFORE UPDATE ON public.partner_logos_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.partner_logos_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Storage RLS for partner-logos bucket (public bucket, admin-only writes)
CREATE POLICY "Admins upload partner-logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update partner-logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete partner-logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'partner-logos' AND has_role(auth.uid(), 'admin'));
