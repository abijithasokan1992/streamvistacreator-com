
DO $$ BEGIN CREATE TYPE public.title_commercial_status AS ENUM ('not_open','screening_only','licensing_open','acquisition_open','invite_only','internal_hold'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.right_category AS ENUM ('screening','digital_ott','satellite_tv','theatrical','airline_nontheatrical','remake_adaptation','dubbing_derivative','distribution_representation','acquisition'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.right_exclusivity AS ENUM ('exclusive','non_exclusive','hold','unavailable'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.right_status AS ENUM ('available','hold','sold','blocked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.deal_type AS ENUM ('licensing','screener','acquisition','distribution_representation','rights_information'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.deal_status AS ENUM ('draft','screening_requested','screening_shared','negotiating','offer_sent','won','lost','expired','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.title_commercial_profiles
  ADD COLUMN IF NOT EXISTS commercial_status public.title_commercial_status NOT NULL DEFAULT 'not_open',
  ADD COLUMN IF NOT EXISTS available_for_screeners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for_nonexclusive_license boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for_exclusive_license boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for_acquisition boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for_distribution_partnership boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rights_status_summary text,
  ADD COLUMN IF NOT EXISTS legal_clearance_summary text,
  ADD COLUMN IF NOT EXISTS delivery_readiness_summary text,
  ADD COLUMN IF NOT EXISTS chain_of_title_notes text,
  ADD COLUMN IF NOT EXISTS buyer_facing_summary text,
  ADD COLUMN IF NOT EXISTS admin_internal_notes text,
  ADD COLUMN IF NOT EXISTS published_to_buyers boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.title_rights_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  right_category public.right_category NOT NULL,
  territory text NOT NULL DEFAULT 'worldwide',
  language text NOT NULL DEFAULT 'original',
  exclusivity public.right_exclusivity NOT NULL DEFAULT 'non_exclusive',
  status public.right_status NOT NULL DEFAULT 'available',
  term_start date,
  term_end date,
  committed_deal_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trights_title ON public.title_rights_availability(title_id);
CREATE INDEX IF NOT EXISTS idx_trights_status ON public.title_rights_availability(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_rights_availability TO authenticated;
GRANT ALL ON public.title_rights_availability TO service_role;
ALTER TABLE public.title_rights_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage title rights" ON public.title_rights_availability FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner reads title rights" ON public.title_rights_availability FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = title_rights_availability.title_id AND ct.owner_user_id = auth.uid()));

CREATE TRIGGER trg_trights_updated BEFORE UPDATE ON public.title_rights_availability
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.deal_memo_seq START 1001;

CREATE TABLE IF NOT EXISTS public.deal_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_number text NOT NULL UNIQUE DEFAULT ('DM-' || lpad(nextval('public.deal_memo_seq')::text, 6, '0')),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE RESTRICT,
  buyer_user_id uuid,
  buyer_org_name text,
  buyer_contact_email text,
  commercial_request_id uuid REFERENCES public.commercial_requests(id) ON DELETE SET NULL,
  deal_type public.deal_type NOT NULL,
  status public.deal_status NOT NULL DEFAULT 'draft',
  right_category public.right_category,
  territory text DEFAULT 'worldwide',
  language text DEFAULT 'original',
  exclusivity public.right_exclusivity DEFAULT 'non_exclusive',
  term_start date,
  term_end date,
  amount_paise bigint,
  currency text NOT NULL DEFAULT 'INR',
  payment_terms text,
  buyer_facing_memo text,
  internal_notes text,
  owner_admin_id uuid,
  created_by uuid,
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deal_memos_title ON public.deal_memos(title_id);
CREATE INDEX IF NOT EXISTS idx_deal_memos_buyer ON public.deal_memos(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_deal_memos_status ON public.deal_memos(status);

ALTER TABLE public.title_rights_availability
  ADD CONSTRAINT trights_deal_fk FOREIGN KEY (committed_deal_id) REFERENCES public.deal_memos(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_memos TO authenticated;
GRANT ALL ON public.deal_memos TO service_role;
ALTER TABLE public.deal_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deal memos" ON public.deal_memos FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Owner or buyer reads deals" ON public.deal_memos FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR buyer_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = deal_memos.title_id AND ct.owner_user_id = auth.uid())
  );

CREATE TRIGGER trg_deal_memos_updated BEFORE UPDATE ON public.deal_memos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.deal_memo_check_conflict(_deal_id uuid)
RETURNS TABLE(conflict_count int, sample_memo text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deal_memos;
BEGIN
  SELECT * INTO d FROM public.deal_memos WHERE id = _deal_id;
  IF d.id IS NULL OR d.exclusivity <> 'exclusive' OR d.right_category IS NULL THEN
    RETURN QUERY SELECT 0, NULL::text; RETURN;
  END IF;
  RETURN QUERY
  SELECT count(*)::int, max(memo_number) FROM public.deal_memos x
  WHERE x.id <> d.id AND x.title_id = d.title_id AND x.right_category = d.right_category
    AND x.territory = d.territory AND x.language = d.language
    AND x.exclusivity = 'exclusive'
    AND x.status IN ('won','negotiating','offer_sent','screening_shared');
END $$;

CREATE OR REPLACE FUNCTION public.admin_close_deal_memo(_deal_id uuid, _status public.deal_status)
RETURNS public.deal_memos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.deal_memos;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.deal_memos
    SET status = _status,
        closed_at = CASE WHEN _status IN ('won','lost','expired','cancelled') THEN now() ELSE closed_at END,
        approved_at = CASE WHEN _status = 'won' AND approved_at IS NULL THEN now() ELSE approved_at END,
        updated_at = now()
    WHERE id = _deal_id RETURNING * INTO d;
  IF d.id IS NULL THEN RAISE EXCEPTION 'deal not found'; END IF;
  IF _status = 'won' AND d.right_category IS NOT NULL THEN
    INSERT INTO public.title_rights_availability
      (title_id, right_category, territory, language, exclusivity, status, term_start, term_end, committed_deal_id, notes, created_by)
    VALUES
      (d.title_id, d.right_category, COALESCE(d.territory,'worldwide'), COALESCE(d.language,'original'),
       COALESCE(d.exclusivity,'non_exclusive'), 'sold', d.term_start, d.term_end, d.id,
       'Auto-committed from ' || d.memo_number, auth.uid());
  END IF;
  INSERT INTO public.commercial_audit_log(actor_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'deal_memo_status', 'deal_memo', d.id,
          jsonb_build_object('memo_number', d.memo_number, 'status', _status));
  RETURN d;
END $$;

GRANT EXECUTE ON FUNCTION public.deal_memo_check_conflict(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_close_deal_memo(uuid, public.deal_status) TO authenticated;
