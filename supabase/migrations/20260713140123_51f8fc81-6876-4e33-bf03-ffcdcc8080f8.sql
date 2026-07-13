DO $$ BEGIN
  CREATE TYPE public.ai_review_status AS ENUM (
    'not_submitted','rights_review_required','technical_review_required',
    'clarification_requested','eligible_for_matching','not_eligible','licensed','suspended'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.ai_tri_state AS ENUM ('yes','no','undecided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.ai_rights_authorization AS ENUM ('yes','no','pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.ai_exclusivity AS ENUM ('exclusive','non_exclusive','unspecified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.ai_commercial_mode AS ENUM ('commercial','research','both','unspecified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.title_ai_licensing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  available_for_review public.ai_tri_state NOT NULL DEFAULT 'undecided',
  rights_holder_authorized public.ai_rights_authorization NOT NULL DEFAULT 'pending',
  approved_use_cases TEXT[] NOT NULL DEFAULT '{}',
  prohibited_use_cases TEXT[] NOT NULL DEFAULT '{}',
  licence_term TEXT,
  territory TEXT,
  exclusivity public.ai_exclusivity NOT NULL DEFAULT 'unspecified',
  commercial_model TEXT,
  performer_consent_status TEXT,
  music_rights_status TEXT,
  source_master_available BOOLEAN NOT NULL DEFAULT false,
  resolution TEXT,
  frame_rate TEXT,
  lip_sync_qc_status TEXT,
  audio_languages TEXT[] NOT NULL DEFAULT '{}',
  subtitle_languages TEXT[] NOT NULL DEFAULT '{}',
  review_status public.ai_review_status NOT NULL DEFAULT 'not_submitted',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_ai_licensing TO authenticated;
GRANT ALL ON public.title_ai_licensing TO service_role;
ALTER TABLE public.title_ai_licensing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_lic_owner_select" ON public.title_ai_licensing FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_lic_owner_insert" ON public.title_ai_licensing FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "ai_lic_owner_update" ON public.title_ai_licensing FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_lic_admin_delete" ON public.title_ai_licensing FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.enforce_ai_licensing_transitions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE is_admin BOOLEAN;
BEGIN
  is_admin := public.has_role(auth.uid(), 'admin'::public.app_role);
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin THEN
      NEW.review_status := 'not_submitted';
      IF NEW.rights_holder_authorized = 'yes' THEN
        NEW.rights_holder_authorized := 'pending';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NOT is_admin THEN
      IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN
        NEW.review_status := OLD.review_status;
      END IF;
      IF NEW.rights_holder_authorized = 'yes' AND OLD.rights_holder_authorized <> 'yes' THEN
        NEW.rights_holder_authorized := OLD.rights_holder_authorized;
      END IF;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_ai_licensing_transitions ON public.title_ai_licensing;
CREATE TRIGGER trg_enforce_ai_licensing_transitions
  BEFORE INSERT OR UPDATE ON public.title_ai_licensing
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_licensing_transitions();

CREATE TABLE IF NOT EXISTS public.title_ai_licensing_admin (
  title_id UUID PRIMARY KEY REFERENCES public.content_titles(id) ON DELETE CASCADE,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  match_notes TEXT,
  commercial_proposal TEXT,
  contract_status TEXT,
  delivery_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_ai_licensing_admin TO authenticated;
GRANT ALL ON public.title_ai_licensing_admin TO service_role;
ALTER TABLE public.title_ai_licensing_admin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_lic_admin_only_all" ON public.title_ai_licensing_admin FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.title_ai_licensing_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  document_kind TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'title-ai-rights-docs',
  storage_path TEXT NOT NULL,
  file_name TEXT,
  content_type TEXT,
  size_bytes BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_ai_licensing_documents TO authenticated;
GRANT ALL ON public.title_ai_licensing_documents TO service_role;
ALTER TABLE public.title_ai_licensing_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_docs_owner_select" ON public.title_ai_licensing_documents FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_docs_owner_insert" ON public.title_ai_licensing_documents FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "ai_docs_owner_update" ON public.title_ai_licensing_documents FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_docs_owner_delete" ON public.title_ai_licensing_documents FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.ai_buyer_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization TEXT NOT NULL,
  authorized_contact_name TEXT NOT NULL,
  authorized_contact_email TEXT NOT NULL,
  intended_ai_use_case TEXT NOT NULL,
  content_types TEXT, languages TEXT, required_hours TEXT, resolution TEXT,
  audio_specs TEXT, licence_term TEXT, territories TEXT, model_training_purpose TEXT,
  commercial_or_research public.ai_commercial_mode NOT NULL DEFAULT 'unspecified',
  derived_output_requirements TEXT, data_retention TEXT, deletion_requirements TEXT,
  security_requirements TEXT, prohibited_content TEXT, target_budget TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  submitted_by UUID, source_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_buyer_requirements TO authenticated;
GRANT ALL ON public.ai_buyer_requirements TO service_role;
ALTER TABLE public.ai_buyer_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_buyer_admin_read" ON public.ai_buyer_requirements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_buyer_admin_write" ON public.ai_buyer_requirements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.ai_licensing_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,
  buyer_name TEXT NOT NULL,
  primary_content TEXT[] NOT NULL DEFAULT '{}',
  secondary_content TEXT[] NOT NULL DEFAULT '{}',
  preferred_languages TEXT[] NOT NULL DEFAULT '{}',
  approx_hours_required TEXT,
  min_resolution TEXT, preferred_resolution TEXT, technical_notes TEXT,
  commercial_terms TEXT NOT NULL DEFAULT 'Pending',
  licence_term TEXT NOT NULL DEFAULT 'Pending clarification',
  territory TEXT NOT NULL DEFAULT 'Pending clarification',
  exclusivity TEXT NOT NULL DEFAULT 'Pending clarification',
  ai_rights_scope TEXT NOT NULL DEFAULT 'Pending clarification',
  talent_consent_requirements TEXT NOT NULL DEFAULT 'Pending clarification',
  delivery_specifications TEXT NOT NULL DEFAULT 'Pending clarification',
  status TEXT NOT NULL DEFAULT 'open',
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_licensing_opportunities TO authenticated;
GRANT ALL ON public.ai_licensing_opportunities TO service_role;
ALTER TABLE public.ai_licensing_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_opps_admin_all" ON public.ai_licensing_opportunities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.ai_licensing_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.ai_licensing_opportunities(id) ON DELETE CASCADE,
  title_id UUID NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'proposed',
  admin_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_licensing_matches TO authenticated;
GRANT ALL ON public.ai_licensing_matches TO service_role;
ALTER TABLE public.ai_licensing_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_match_admin_all" ON public.ai_licensing_matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.ai_licensing_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_licensing_audit_log TO authenticated;
GRANT ALL ON public.ai_licensing_audit_log TO service_role;
ALTER TABLE public.ai_licensing_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_audit_admin_read" ON public.ai_licensing_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "ai_audit_self_insert" ON public.ai_licensing_audit_log FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

INSERT INTO public.ai_licensing_opportunities (
  reference_code, buyer_name,
  primary_content, secondary_content, preferred_languages,
  approx_hours_required, min_resolution, preferred_resolution, technical_notes
) VALUES (
  'SHAIP-700', 'SHAIP',
  ARRAY['Feature films','TV series'],
  ARRAY['Advertisements','Interviews','News broadcasts','Panel discussions','Professionally recorded podcasts','Premium licensed YouTube content'],
  ARRAY['English (US)','English (UK)','English (Australian)','Spanish','Italian','French','German'],
  '~1000 hours','1080p','4K',
  'Original source preferred; accurate lip sync; no frame drops; minimal re-encoding; source licensing information available'
) ON CONFLICT (reference_code) DO NOTHING;
