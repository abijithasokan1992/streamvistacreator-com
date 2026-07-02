
-- Ensure shared updated_at helper exists in public
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- ENTITY PROFILES FOUNDATION
-- =========================================================================
CREATE TABLE public.entity_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('creator','studio','buyer')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  legal_name TEXT,
  display_name TEXT,
  entity_type TEXT,
  avatar_url TEXT,

  primary_email TEXT,
  primary_phone TEXT,
  whatsapp TEXT,
  website TEXT,

  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'IN',

  pan_number TEXT,
  gstin TEXT,
  tan_number TEXT,
  cin_number TEXT,
  is_gst_registered BOOLEAN NOT NULL DEFAULT false,
  place_of_supply_state TEXT,

  billing_legal_name TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT DEFAULT 'IN',
  billing_notes TEXT,

  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  verification_notes TEXT,
  last_verified_at TIMESTAMPTZ,
  profile_completion_pct INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT entity_profiles_subject_chk CHECK (
    (kind = 'creator' AND user_id IS NOT NULL AND org_id IS NULL) OR
    (kind IN ('studio','buyer') AND org_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE UNIQUE INDEX entity_profiles_creator_uidx
  ON public.entity_profiles(user_id) WHERE kind = 'creator';
CREATE UNIQUE INDEX entity_profiles_org_uidx
  ON public.entity_profiles(org_id, kind) WHERE org_id IS NOT NULL;
CREATE INDEX entity_profiles_kind_idx ON public.entity_profiles(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_profiles TO authenticated;
GRANT ALL ON public.entity_profiles TO service_role;
ALTER TABLE public.entity_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_entity_profile(_kind TEXT, _user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (_kind = 'creator' AND _user_id = auth.uid())
    OR (_org_id IS NOT NULL AND public.is_workspace_admin(_org_id, auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.can_view_entity_profile(_kind TEXT, _user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (_kind = 'creator' AND _user_id = auth.uid())
    OR (_org_id IS NOT NULL AND public.is_workspace_member(_org_id, auth.uid()));
$$;

CREATE POLICY "view entity profile" ON public.entity_profiles
  FOR SELECT TO authenticated
  USING (public.can_view_entity_profile(kind, user_id, org_id));
CREATE POLICY "insert entity profile" ON public.entity_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_entity_profile(kind, user_id, org_id));
CREATE POLICY "update entity profile" ON public.entity_profiles
  FOR UPDATE TO authenticated
  USING (public.can_edit_entity_profile(kind, user_id, org_id))
  WITH CHECK (public.can_edit_entity_profile(kind, user_id, org_id));
CREATE POLICY "delete entity profile" ON public.entity_profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER entity_profiles_updated
  BEFORE UPDATE ON public.entity_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_edit_entity_profile_by_id(_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.entity_profiles p
    WHERE p.id = _profile_id AND public.can_edit_entity_profile(p.kind, p.user_id, p.org_id));
$$;

CREATE OR REPLACE FUNCTION public.can_view_entity_profile_by_id(_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.entity_profiles p
    WHERE p.id = _profile_id AND public.can_view_entity_profile(p.kind, p.user_id, p.org_id));
$$;

-- =========================================================================
-- SOCIALS
-- =========================================================================
CREATE TABLE public.entity_profile_socials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.entity_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  label TEXT,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX entity_profile_socials_profile_idx ON public.entity_profile_socials(profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_profile_socials TO authenticated;
GRANT ALL ON public.entity_profile_socials TO service_role;
ALTER TABLE public.entity_profile_socials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view socials" ON public.entity_profile_socials
  FOR SELECT TO authenticated USING (public.can_view_entity_profile_by_id(profile_id));
CREATE POLICY "manage socials" ON public.entity_profile_socials
  FOR ALL TO authenticated
  USING (public.can_edit_entity_profile_by_id(profile_id))
  WITH CHECK (public.can_edit_entity_profile_by_id(profile_id));
CREATE TRIGGER entity_profile_socials_updated
  BEFORE UPDATE ON public.entity_profile_socials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- CREATOR EXT
-- =========================================================================
CREATE TABLE public.entity_profile_creator_ext (
  profile_id UUID NOT NULL PRIMARY KEY REFERENCES public.entity_profiles(id) ON DELETE CASCADE,
  professional_name TEXT,
  bio TEXT,
  primary_genres TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{}',
  regions TEXT[] NOT NULL DEFAULT '{}',
  years_active INT,
  banner_company_name TEXT,
  imdb_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_profile_creator_ext TO authenticated;
GRANT ALL ON public.entity_profile_creator_ext TO service_role;
ALTER TABLE public.entity_profile_creator_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view creator ext" ON public.entity_profile_creator_ext
  FOR SELECT TO authenticated USING (public.can_view_entity_profile_by_id(profile_id));
CREATE POLICY "manage creator ext" ON public.entity_profile_creator_ext
  FOR ALL TO authenticated
  USING (public.can_edit_entity_profile_by_id(profile_id))
  WITH CHECK (public.can_edit_entity_profile_by_id(profile_id));
CREATE TRIGGER entity_profile_creator_ext_updated
  BEFORE UPDATE ON public.entity_profile_creator_ext
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- STUDIO EXT
-- =========================================================================
CREATE TABLE public.entity_profile_studio_ext (
  profile_id UUID NOT NULL PRIMARY KEY REFERENCES public.entity_profiles(id) ON DELETE CASCADE,
  about TEXT,
  services TEXT[] NOT NULL DEFAULT '{}',
  facility_capabilities TEXT[] NOT NULL DEFAULT '{}',
  languages_served TEXT[] NOT NULL DEFAULT '{}',
  regions_served TEXT[] NOT NULL DEFAULT '{}',
  primary_contact_name TEXT,
  primary_contact_designation TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  year_founded INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_profile_studio_ext TO authenticated;
GRANT ALL ON public.entity_profile_studio_ext TO service_role;
ALTER TABLE public.entity_profile_studio_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view studio ext" ON public.entity_profile_studio_ext
  FOR SELECT TO authenticated USING (public.can_view_entity_profile_by_id(profile_id));
CREATE POLICY "manage studio ext" ON public.entity_profile_studio_ext
  FOR ALL TO authenticated
  USING (public.can_edit_entity_profile_by_id(profile_id))
  WITH CHECK (public.can_edit_entity_profile_by_id(profile_id));
CREATE TRIGGER entity_profile_studio_ext_updated
  BEFORE UPDATE ON public.entity_profile_studio_ext
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- BUYER EXT
-- =========================================================================
CREATE TABLE public.entity_profile_buyer_ext (
  profile_id UUID NOT NULL PRIMARY KEY REFERENCES public.entity_profiles(id) ON DELETE CASCADE,
  platform_type TEXT,
  acquisitions_contact_name TEXT,
  acquisitions_contact_designation TEXT,
  acquisitions_contact_email TEXT,
  acquisitions_contact_phone TEXT,
  licensing_email TEXT,
  programming_email TEXT,
  territories TEXT[] NOT NULL DEFAULT '{}',
  content_types TEXT[] NOT NULL DEFAULT '{}',
  languages_acquired TEXT[] NOT NULL DEFAULT '{}',
  channel_numbers TEXT[] NOT NULL DEFAULT '{}',
  app_store_url TEXT,
  play_store_url TEXT,
  ott_app_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_profile_buyer_ext TO authenticated;
GRANT ALL ON public.entity_profile_buyer_ext TO service_role;
ALTER TABLE public.entity_profile_buyer_ext ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view buyer ext" ON public.entity_profile_buyer_ext
  FOR SELECT TO authenticated USING (public.can_view_entity_profile_by_id(profile_id));
CREATE POLICY "manage buyer ext" ON public.entity_profile_buyer_ext
  FOR ALL TO authenticated
  USING (public.can_edit_entity_profile_by_id(profile_id))
  WITH CHECK (public.can_edit_entity_profile_by_id(profile_id));
CREATE TRIGGER entity_profile_buyer_ext_updated
  BEFORE UPDATE ON public.entity_profile_buyer_ext
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- COMPLETION %
-- =========================================================================
CREATE OR REPLACE FUNCTION public.recompute_entity_profile_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  filled INT := 0;
  total  INT := 12;
BEGIN
  IF COALESCE(NEW.legal_name,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.display_name,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.primary_email,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.primary_phone,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.address_line1,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.city,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.state,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.postal_code,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.country,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.pan_number,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.billing_legal_name,'') <> '' THEN filled := filled + 1; END IF;
  IF COALESCE(NEW.billing_email,'') <> '' THEN filled := filled + 1; END IF;
  NEW.profile_completion_pct := (filled * 100) / total;
  RETURN NEW;
END;
$$;

CREATE TRIGGER entity_profiles_completion
  BEFORE INSERT OR UPDATE ON public.entity_profiles
  FOR EACH ROW EXECUTE FUNCTION public.recompute_entity_profile_completion();
