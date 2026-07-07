-- Partner profiles: rich metadata for public marketing + Creator workspace matching
CREATE TABLE public.partner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  logo_url text,
  website_url text,
  hero_image_url text,

  -- Public marketing
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  categories text[] NOT NULL DEFAULT '{}',  -- e.g. {OTT, Broadcast, Theatrical}

  -- Creator-workspace profile fields
  submission_requirements text,             -- prose: what they need to submit
  licensing_models text[] NOT NULL DEFAULT '{}',  -- {AVOD, SVOD, TVOD, FAST, Theatrical, Broadcast}
  territories text[] NOT NULL DEFAULT '{}', -- ISO country codes or region names
  languages text[] NOT NULL DEFAULT '{}',
  content_preferences text[] NOT NULL DEFAULT '{}',  -- genres/formats {Feature, Series, Short, Documentary, Regional}
  runtime_min_minutes integer,
  runtime_max_minutes integer,
  min_resolution text,                      -- e.g. 'HD', '4K'
  audio_requirements text,
  subtitle_requirements text,
  exclusivity text,                         -- 'exclusive' | 'non_exclusive' | 'flexible'
  revenue_share_notes text,
  deal_timeline_days integer,
  contact_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.partner_profiles TO anon;
GRANT SELECT ON public.partner_profiles TO authenticated;
GRANT ALL ON public.partner_profiles TO service_role;

ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

-- Public read (only active partners) for marketing page and Creator workspace
CREATE POLICY "Anyone can view active partner profiles"
  ON public.partner_profiles FOR SELECT
  USING (is_active = true);

-- Admins/super admins full management
CREATE POLICY "Admins manage partner profiles"
  ON public.partner_profiles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_partner_profiles_updated_at
  BEFORE UPDATE ON public.partner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX partner_profiles_active_sort_idx ON public.partner_profiles (is_active, sort_order);

-- Cache AI match scores per (title, partner) to avoid re-calling the model on every view
CREATE TABLE public.partner_title_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  partner_profile_id uuid NOT NULL REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,               -- creator who owns the title (denormalized for RLS)
  score integer NOT NULL,                    -- 0-100
  rule_score integer NOT NULL,               -- deterministic portion
  ai_rationale text,                         -- optional AI explanation
  strengths text[] NOT NULL DEFAULT '{}',
  gaps text[] NOT NULL DEFAULT '{}',
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, partner_profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_title_matches TO authenticated;
GRANT ALL ON public.partner_title_matches TO service_role;

ALTER TABLE public.partner_title_matches ENABLE ROW LEVEL SECURITY;

-- Owners see their own title-match rows
CREATE POLICY "Owners view own matches"
  ON public.partner_title_matches FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

-- Owners can upsert scores for their own titles
CREATE POLICY "Owners insert own matches"
  ON public.partner_title_matches FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update own matches"
  ON public.partner_title_matches FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Admins manage matches"
  ON public.partner_title_matches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE TRIGGER update_partner_title_matches_updated_at
  BEFORE UPDATE ON public.partner_title_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX partner_title_matches_owner_idx ON public.partner_title_matches (owner_user_id);
CREATE INDEX partner_title_matches_title_idx ON public.partner_title_matches (title_id);
