
CREATE TABLE IF NOT EXISTS public.offer_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commercial_request_id UUID NOT NULL REFERENCES public.commercial_requests(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL DEFAULT 1,
  party TEXT NOT NULL CHECK (party IN ('buyer','admin','owner')),
  actor_user_id UUID,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  message TEXT,
  amount_paise BIGINT,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','countered','accepted','rejected','withdrawn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_rounds_request_idx ON public.offer_rounds(commercial_request_id, round_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_rounds TO authenticated;
GRANT ALL ON public.offer_rounds TO service_role;
ALTER TABLE public.offer_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all offer rounds" ON public.offer_rounds FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Buyer sees own request rounds" ON public.offer_rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commercial_requests cr WHERE cr.id = offer_rounds.commercial_request_id AND cr.buyer_user_id = auth.uid()));

CREATE POLICY "Buyer inserts own request rounds" ON public.offer_rounds FOR INSERT TO authenticated
  WITH CHECK (party = 'buyer' AND actor_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.commercial_requests cr WHERE cr.id = commercial_request_id AND cr.buyer_user_id = auth.uid()));

CREATE POLICY "Owner sees own title rounds" ON public.offer_rounds FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.commercial_requests cr
    JOIN public.content_titles ct ON ct.id = cr.title_id
    WHERE cr.id = offer_rounds.commercial_request_id AND ct.owner_user_id = auth.uid()
  ));

CREATE TABLE IF NOT EXISTS public.license_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_memo_id UUID NOT NULL REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  title_id UUID REFERENCES public.content_titles(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  document_url TEXT,
  document_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','buyer_signed','fully_signed','void')),
  buyer_signed_at TIMESTAMPTZ,
  buyer_signer_name TEXT,
  owner_signed_at TIMESTAMPTZ,
  owner_signer_name TEXT,
  countersigned_at TIMESTAMPTZ,
  countersigned_by UUID,
  legal_text TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_contracts_deal_idx ON public.license_contracts(deal_memo_id, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_contracts TO authenticated;
GRANT ALL ON public.license_contracts TO service_role;
ALTER TABLE public.license_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all contracts" ON public.license_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Buyer sees own contracts" ON public.license_contracts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deal_memos dm WHERE dm.id = license_contracts.deal_memo_id AND dm.buyer_user_id = auth.uid()));

CREATE POLICY "Owner sees own title contracts" ON public.license_contracts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_memos dm
    JOIN public.content_titles ct ON ct.id = dm.title_id
    WHERE dm.id = license_contracts.deal_memo_id AND ct.owner_user_id = auth.uid()
  ));

CREATE TRIGGER license_contracts_touch BEFORE UPDATE ON public.license_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.license_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_memo_id UUID NOT NULL REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'executed','activated','delivery_started','delivery_completed',
    'expiring_soon','expired','renewed','terminated','breach_notice','note'
  )),
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_events_deal_idx ON public.license_events(deal_memo_id, event_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_events TO authenticated;
GRANT ALL ON public.license_events TO service_role;
ALTER TABLE public.license_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all license events" ON public.license_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Buyer sees own license events" ON public.license_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.deal_memos dm WHERE dm.id = license_events.deal_memo_id AND dm.buyer_user_id = auth.uid()));

CREATE POLICY "Owner sees own title license events" ON public.license_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_memos dm
    JOIN public.content_titles ct ON ct.id = dm.title_id
    WHERE dm.id = license_events.deal_memo_id AND ct.owner_user_id = auth.uid()
  ));
