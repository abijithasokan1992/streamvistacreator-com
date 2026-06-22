
-- =========================================================
-- LEGAL + COMMERCIAL GOVERNANCE FOUNDATION
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.legal_agreement_type AS ENUM (
    'creator_master',
    'buyer_request_confidentiality',
    'free_tier_commercial',
    'screener_access',
    'antipiracy_addendum'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deal_mode AS ENUM ('admin_managed','creator_managed','hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.protection_tier AS ENUM ('baseline','enhanced','forensic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commercial_request_type AS ENUM (
    'acquisition','licensing','distribution','screener','rights_info'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.commercial_request_state AS ENUM (
    'pending_admin_review',
    'awaiting_creator_review',
    'more_info_required',
    'rejected',
    'approved_for_negotiation',
    'agreement_pending',
    'delivery_authorized',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- 1) legal_agreements (versioned templates)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.legal_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_type public.legal_agreement_type NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  summary text,
  is_published boolean NOT NULL DEFAULT false,
  is_current boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_type, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS legal_agreements_one_current_per_type
  ON public.legal_agreements (agreement_type) WHERE is_current = true;

GRANT SELECT ON public.legal_agreements TO authenticated;
GRANT ALL ON public.legal_agreements TO service_role;
ALTER TABLE public.legal_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed reads published agreements"
  ON public.legal_agreements FOR SELECT TO authenticated
  USING (is_published = true);

CREATE POLICY "Admins manage agreements"
  ON public.legal_agreements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- 2) legal_acceptances
-- =========================================================
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  agreement_id uuid NOT NULL REFERENCES public.legal_agreements(id) ON DELETE RESTRICT,
  agreement_type public.legal_agreement_type NOT NULL,
  version integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, agreement_id)
);
CREATE INDEX IF NOT EXISTS legal_acceptances_user_type_idx
  ON public.legal_acceptances (user_id, agreement_type);

GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own acceptances"
  ON public.legal_acceptances FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own acceptances"
  ON public.legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Helper: did this user accept the CURRENT published version of an agreement type?
CREATE OR REPLACE FUNCTION public.has_accepted_agreement(_user_id uuid, _type public.legal_agreement_type)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_acceptances la
    JOIN public.legal_agreements a ON a.id = la.agreement_id
    WHERE la.user_id = _user_id
      AND a.agreement_type = _type
      AND a.is_current = true
  );
$$;

-- =========================================================
-- 3) title_commercial_profiles
-- =========================================================
CREATE TABLE IF NOT EXISTS public.title_commercial_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL UNIQUE REFERENCES public.content_titles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  creator_tier text NOT NULL DEFAULT 'free',
  deal_mode public.deal_mode NOT NULL DEFAULT 'admin_managed',
  acquisition_open boolean NOT NULL DEFAULT false,
  licensing_open boolean NOT NULL DEFAULT false,
  distribution_open boolean NOT NULL DEFAULT false,
  screening_allowed boolean NOT NULL DEFAULT false,
  admin_approval_required boolean NOT NULL DEFAULT true,
  creator_final_approval_required boolean NOT NULL DEFAULT true,
  protection_tier public.protection_tier NOT NULL DEFAULT 'baseline',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.title_commercial_profiles TO authenticated;
GRANT ALL ON public.title_commercial_profiles TO service_role;
ALTER TABLE public.title_commercial_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner or admin reads commercial profile"
  ON public.title_commercial_profiles FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins manage commercial profiles"
  ON public.title_commercial_profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create admin-managed profile on new title (Free-tier safe default).
CREATE OR REPLACE FUNCTION public.tg_create_commercial_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.title_commercial_profiles (title_id, owner_user_id)
  VALUES (NEW.id, NEW.owner_user_id)
  ON CONFLICT (title_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS content_titles_create_commercial_profile ON public.content_titles;
CREATE TRIGGER content_titles_create_commercial_profile
  AFTER INSERT ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.tg_create_commercial_profile();

-- Backfill profiles for existing titles
INSERT INTO public.title_commercial_profiles (title_id, owner_user_id)
SELECT ct.id, ct.owner_user_id
FROM public.content_titles ct
LEFT JOIN public.title_commercial_profiles p ON p.title_id = ct.id
WHERE p.id IS NULL;

-- =========================================================
-- 4) commercial_requests
-- =========================================================
CREATE TABLE IF NOT EXISTS public.commercial_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type public.commercial_request_type NOT NULL,
  state public.commercial_request_state NOT NULL DEFAULT 'pending_admin_review',
  buyer_user_id uuid NOT NULL,
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  message text,
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text,
  assigned_admin_id uuid,
  accepted_agreement_id uuid REFERENCES public.legal_agreements(id),
  state_changed_at timestamptz NOT NULL DEFAULT now(),
  state_changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_requests_buyer_idx ON public.commercial_requests (buyer_user_id, state);
CREATE INDEX IF NOT EXISTS commercial_requests_owner_idx ON public.commercial_requests (owner_user_id, state);
CREATE INDEX IF NOT EXISTS commercial_requests_title_idx ON public.commercial_requests (title_id);

GRANT SELECT, INSERT, UPDATE ON public.commercial_requests TO authenticated;
GRANT ALL ON public.commercial_requests TO service_role;
ALTER TABLE public.commercial_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer/owner/admin read commercial requests"
  ON public.commercial_requests FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR owner_user_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "Buyer creates own request after NDA"
  ON public.commercial_requests FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND public.has_accepted_agreement(auth.uid(),'buyer_request_confidentiality')
  );

CREATE POLICY "Admin updates any commercial request"
  ON public.commercial_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Owner updates only awaiting_creator_review"
  ON public.commercial_requests FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() AND state = 'awaiting_creator_review')
  WITH CHECK (owner_user_id = auth.uid());

-- =========================================================
-- 5) commercial_request_events (audit)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.commercial_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.commercial_requests(id) ON DELETE CASCADE,
  from_state public.commercial_request_state,
  to_state public.commercial_request_state NOT NULL,
  actor_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_request_events_req_idx
  ON public.commercial_request_events (request_id, created_at DESC);

GRANT SELECT ON public.commercial_request_events TO authenticated;
GRANT ALL ON public.commercial_request_events TO service_role;
ALTER TABLE public.commercial_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read events if you can read the request"
  ON public.commercial_request_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commercial_requests r
    WHERE r.id = request_id
      AND (r.buyer_user_id = auth.uid()
           OR r.owner_user_id = auth.uid()
           OR public.has_role(auth.uid(),'admin'))
  ));

-- Trigger: log state transitions on commercial_requests
CREATE OR REPLACE FUNCTION public.tg_log_commercial_request_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, NULL, NEW.state, auth.uid(), 'created');
  ELSIF TG_OP = 'UPDATE' AND NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO public.commercial_request_events (request_id, from_state, to_state, actor_user_id, note)
    VALUES (NEW.id, OLD.state, NEW.state, auth.uid(), NEW.admin_notes);
    NEW.state_changed_at := now();
    NEW.state_changed_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS commercial_requests_log_state ON public.commercial_requests;
CREATE TRIGGER commercial_requests_log_state
  BEFORE INSERT OR UPDATE ON public.commercial_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_commercial_request_state();

-- updated_at triggers (reuse existing helper if present, else inline)
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS legal_agreements_touch ON public.legal_agreements;
CREATE TRIGGER legal_agreements_touch BEFORE UPDATE ON public.legal_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS title_commercial_profiles_touch ON public.title_commercial_profiles;
CREATE TRIGGER title_commercial_profiles_touch BEFORE UPDATE ON public.title_commercial_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS commercial_requests_touch ON public.commercial_requests;
CREATE TRIGGER commercial_requests_touch BEFORE UPDATE ON public.commercial_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- =========================================================
-- 6) Seed v1 agreement drafts (placeholder, draft SaaS wording)
-- =========================================================
INSERT INTO public.legal_agreements (agreement_type, version, title, body, summary, is_published, is_current, published_at)
VALUES
('creator_master', 1, 'StreamVista Creator / Rights Holder Master Agreement (v1 draft)',
 E'DRAFT — NOT LEGAL ADVICE. Replace before commercial launch.\n\n1. Eligibility. You confirm you are the rights holder or duly authorised representative of the content uploaded to StreamVista.\n2. Grant. You grant StreamVista OPC Pvt Ltd a limited, non-exclusive licence to host, transcode, store, and display your content solely to deliver the platform services you have requested.\n3. Free Tier. You acknowledge that Free tier titles operate under admin-managed commercial workflows; StreamVista may broker, decline, or escalate any commercial enquiry on your behalf and will obtain your final approval before any binding offer is accepted.\n4. Warranties. You warrant your content does not infringe third-party rights and complies with applicable law.\n5. Termination. Either party may terminate with written notice; your data is retained per the platform retention policy.\n6. Liability. StreamVista is not liable for indirect losses; total liability is capped at the fees paid in the prior 12 months.\n7. Governing Law. Republic of India, courts of Kerala.',
 'Master terms for creators and rights holders uploading content.',
 true, true, now()),

('buyer_request_confidentiality', 1, 'Buyer Request & Confidentiality Terms (v1 draft)',
 E'DRAFT — NOT LEGAL ADVICE. Replace before commercial launch.\n\n1. Purpose. These terms govern your submission of acquisition, licensing, distribution, screener or rights-information requests via StreamVista.\n2. Confidentiality. All title information, screeners, financial terms and creator details disclosed to you are confidential and may be used solely to evaluate a potential commercial relationship.\n3. No Recording. You will not record, screen-capture, redistribute or transmit any screener or asset to any third party.\n4. Admin Brokered. Requests against Free tier titles are reviewed and brokered by StreamVista admins; you will not contact creators directly outside the platform.\n5. Good Faith. You confirm your request is made in good faith with genuine commercial intent.\n6. Breach. Breach may result in immediate suspension and legal action.\n7. Survival. Confidentiality survives for 3 years from disclosure.',
 'Buyer NDA / good-faith terms required before submitting any commercial request.',
 true, true, now()),

('free_tier_commercial', 1, 'Free Tier Commercial Workflow Terms (v1 draft)',
 E'DRAFT — NOT LEGAL ADVICE. Replace before commercial launch.\n\n1. Admin-Managed Workflow. While your title is on the Free tier, all commercial enquiries are processed via a StreamVista-administered workflow.\n2. No Direct Negotiation. You agree not to negotiate commercial terms directly with buyers introduced via StreamVista without informing the platform.\n3. Approval Gate. Acquisition, licensing, distribution and screener access are disabled by default and only opened upon explicit admin action, with your final approval where required.\n4. Upgrade Path. Self-serve commercial controls are available on paid tiers.\n5. Protection. Free tier includes only baseline protection; advanced anti-piracy and forensic watermarking are paid services.\n6. No Guarantee. Acceptance of a request for review does not guarantee a deal or any specific outcome.',
 'How commercial workflows operate while a title is on the Free tier.',
 true, true, now()),

('screener_access', 1, 'Screener / Asset Access Protection Terms (v1 draft)',
 E'DRAFT — NOT LEGAL ADVICE. Replace before commercial launch.\n\n1. Limited Access. Screener access is granted for the sole purpose of evaluation by the named recipient.\n2. No Distribution. You will not download (unless explicitly enabled), share, record, or redistribute screener content.\n3. Watermarking. Screeners may carry visible and/or forensic watermarks identifying you; tampering is a material breach.\n4. Expiry. Access expires per the link configuration; continued access after expiry is unauthorised.\n5. Audit. StreamVista may audit access logs at any time.\n6. Liability. Unauthorised disclosure may result in damages and injunctive relief.',
 'Terms governing screener and protected asset access.',
 true, true, now()),

('antipiracy_addendum', 1, 'Anti-Piracy & Enhanced Protection Addendum (v1 draft)',
 E'DRAFT — NOT LEGAL ADVICE. Replace before commercial launch.\n\nThis addendum applies only where the title owner has purchased the Enhanced Protection or Forensic Watermarking add-on.\n\n1. Scope. StreamVista will apply enhanced watermarking, link-level encryption, takedown monitoring and forensic tracing to opted-in titles.\n2. No Guarantee. StreamVista makes commercially reasonable efforts but does not guarantee immunity from piracy.\n3. Takedown. StreamVista will pursue takedowns of identified infringing copies on a best-efforts basis.\n4. Fees. Protection fees are billed per the active plan; non-payment downgrades the title to baseline protection.\n5. Termination. Either party may terminate the addendum on 30 days notice; baseline protection continues.',
 'Optional paid addendum for enhanced anti-piracy and forensic protection.',
 true, true, now())
ON CONFLICT (agreement_type, version) DO NOTHING;
