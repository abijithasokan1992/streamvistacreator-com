
CREATE TABLE public.company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_company_name text NOT NULL DEFAULT 'StreamVista OPC Pvt Ltd',
  parent_company_description text NOT NULL DEFAULT 'StreamVista OPC Pvt Ltd is an integrated media infrastructure company headquartered in Ernakulam, Kerala — building secure cloud, licensing, syndication and streaming under one ecosystem.',
  ecosystem_thesis text NOT NULL DEFAULT 'From film creation and IP development to secure cloud preservation, rights management, syndication and digital delivery — StreamVista exists to support cinema across its full lifecycle.',
  founder_name text NOT NULL DEFAULT 'Abijith Asokan',
  founder_role_line text NOT NULL DEFAULT 'Founder & Managing Director — StreamVista OPC Pvt Ltd · Founder — Crayons Pictures / Crayons Bridge / Crayons Loop · Filmmaker · Producer · Writer · Director · Actor',
  founder_bio text NOT NULL DEFAULT 'Abijith Asokan is an Indian filmmaker, producer, writer, director and media entrepreneur building StreamVista OPC Pvt Ltd as an integrated media infrastructure company spanning content creation, secure storage, licensing, syndication and streaming. Through Crayons Pictures, Crayons Bridge and Crayons Loop, he is building an ecosystem designed to support cinema from creation to preservation to global delivery.

His work spans film production, story development, platform building and rights-focused distribution. The vision of StreamVista is to connect filmmaking, media operations, cloud infrastructure and content monetization inside a single long-term ecosystem.',
  founder_image_url text,
  founder_image_alt text DEFAULT 'Abijith Asokan, Founder of StreamVista',
  brands jsonb NOT NULL DEFAULT '[
    {"key":"crayons_pictures","title":"Crayons Pictures","one_liner":"Film production & IP creation","description":"A production banner for original storytelling — feature films, story development and IP creation rooted in cinematic craft."},
    {"key":"crayons_bridge","title":"Crayons Bridge","one_liner":"Distribution, licensing & syndication","description":"The rights and delivery pipeline — content distribution, licensing, syndication and platform-ready delivery for global partners."},
    {"key":"crayons_loop","title":"Crayons Loop","one_liner":"Streaming & digital exhibition","description":"The OTT and digital exhibition surface — bringing curated cinema to audiences through a modern streaming application."}
  ]'::jsonb,
  visibility jsonb NOT NULL DEFAULT '{"hero":true,"founder":true,"brands":true,"works":true,"thesis":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_profile TO anon, authenticated;
GRANT ALL ON public.company_profile TO service_role;

ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read company profile"
  ON public.company_profile FOR SELECT USING (true);
CREATE POLICY "Admins can insert company profile"
  ON public.company_profile FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update company profile"
  ON public.company_profile FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete company profile"
  ON public.company_profile FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_profile_touch_updated_at
  BEFORE UPDATE ON public.company_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.company_profile DEFAULT VALUES;

CREATE TABLE public.founder_works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role text,
  year text,
  synopsis text,
  achievement text,
  banner text DEFAULT 'Crayons Pictures',
  sort_order int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.founder_works TO anon, authenticated;
GRANT ALL ON public.founder_works TO service_role;

ALTER TABLE public.founder_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read founder works"
  ON public.founder_works FOR SELECT USING (true);
CREATE POLICY "Admins manage founder works"
  ON public.founder_works FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER founder_works_touch_updated_at
  BEFORE UPDATE ON public.founder_works
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.founder_works (title, role, synopsis, achievement, banner, sort_order) VALUES
  ('Kolumittayi', 'Producer / Writer', 'Malayalam children''s film produced under Crayons Pictures.', 'Recognised at the Kerala State Film Awards in the children''s film category.', 'Crayons Pictures', 10),
  ('Jananam 1947 Pranayam Thudarunnu', 'Writer / Director / Producer', 'Directorial feature work under Crayons Pictures.', '', 'Crayons Pictures', 20);
