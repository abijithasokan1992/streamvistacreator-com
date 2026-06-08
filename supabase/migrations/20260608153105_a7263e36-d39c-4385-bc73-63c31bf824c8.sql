
CREATE TABLE public.site_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  primary_domain TEXT NOT NULL DEFAULT '',
  extra_origins TEXT[] NOT NULL DEFAULT '{}',
  oracle_tenancy_ocid TEXT,
  oracle_user_ocid TEXT,
  oracle_fingerprint TEXT,
  oracle_region TEXT DEFAULT 'ap-mumbai-1',
  oracle_namespace TEXT,
  oracle_bucket TEXT,
  oracle_private_key_set BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  CONSTRAINT site_config_singleton CHECK (id = TRUE)
);

GRANT SELECT, INSERT, UPDATE ON public.site_config TO authenticated;
GRANT ALL ON public.site_config TO service_role;

ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read site_config" ON public.site_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert site_config" ON public.site_config
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update site_config" ON public.site_config
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER site_config_touch_updated_at
  BEFORE UPDATE ON public.site_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.site_config (id, primary_domain, extra_origins)
VALUES (TRUE, 'https://streamvistacreator.com', ARRAY['https://www.streamvistacreator.com'])
ON CONFLICT (id) DO NOTHING;
