
CREATE TABLE public.revenue_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_label text,
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE SET NULL,
  period_start date,
  period_end date,
  currency text NOT NULL DEFAULT 'INR',
  gross_amount_paise bigint NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  raw_file_url text,
  notes text,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_imports TO authenticated;
GRANT ALL ON public.revenue_imports TO service_role;
ALTER TABLE public.revenue_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage revenue imports" ON public.revenue_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.revenue_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.revenue_imports(id) ON DELETE CASCADE,
  title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL,
  distribution_delivery_id uuid REFERENCES public.distribution_deliveries(id) ON DELETE SET NULL,
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE SET NULL,
  territory text,
  channel text,
  units integer,
  gross_amount_paise bigint NOT NULL DEFAULT 0,
  platform_fee_paise bigint NOT NULL DEFAULT 0,
  net_amount_paise bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  occurred_on date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_revenue_lines_import ON public.revenue_lines(import_id);
CREATE INDEX idx_revenue_lines_title ON public.revenue_lines(title_id);
CREATE INDEX idx_revenue_lines_deal ON public.revenue_lines(deal_memo_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_lines TO authenticated;
GRANT ALL ON public.revenue_lines TO service_role;
ALTER TABLE public.revenue_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage revenue lines" ON public.revenue_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "owners view own revenue lines" ON public.revenue_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = revenue_lines.title_id AND t.owner_user_id = auth.uid()));

CREATE TABLE public.royalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  title_id uuid REFERENCES public.content_titles(id) ON DELETE CASCADE,
  deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE CASCADE,
  beneficiary_type text NOT NULL,
  beneficiary_user_id uuid,
  beneficiary_label text,
  share_pct numeric NOT NULL,
  minimum_guarantee_paise bigint,
  recoup_before_share boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalty_rules TO authenticated;
GRANT ALL ON public.royalty_rules TO service_role;
ALTER TABLE public.royalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage royalty rules" ON public.royalty_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "beneficiary view royalty rules" ON public.royalty_rules FOR SELECT TO authenticated
  USING (beneficiary_user_id = auth.uid());

CREATE TABLE public.royalty_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  gross_paise bigint NOT NULL DEFAULT 0,
  allocated_paise bigint NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalty_runs TO authenticated;
GRANT ALL ON public.royalty_runs TO service_role;
ALTER TABLE public.royalty_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage royalty runs" ON public.royalty_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.royalty_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.royalty_runs(id) ON DELETE CASCADE,
  revenue_line_id uuid REFERENCES public.revenue_lines(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.royalty_rules(id) ON DELETE SET NULL,
  title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL,
  beneficiary_type text NOT NULL,
  beneficiary_user_id uuid,
  beneficiary_label text,
  gross_paise bigint NOT NULL DEFAULT 0,
  share_pct numeric,
  allocated_paise bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'draft',
  deal_payout_id uuid REFERENCES public.deal_payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_royalty_alloc_run ON public.royalty_allocations(run_id);
CREATE INDEX idx_royalty_alloc_ben ON public.royalty_allocations(beneficiary_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.royalty_allocations TO authenticated;
GRANT ALL ON public.royalty_allocations TO service_role;
ALTER TABLE public.royalty_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage royalty allocations" ON public.royalty_allocations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "beneficiary view own allocations" ON public.royalty_allocations FOR SELECT TO authenticated
  USING (beneficiary_user_id = auth.uid());

CREATE TABLE public.partner_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE SET NULL,
  beneficiary_user_id uuid,
  statement_number text UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_paise bigint NOT NULL DEFAULT 0,
  fees_paise bigint NOT NULL DEFAULT 0,
  net_paise bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'draft',
  pdf_url text,
  line_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  issued_at timestamptz,
  settled_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_statements TO authenticated;
GRANT ALL ON public.partner_statements TO service_role;
ALTER TABLE public.partner_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage partner statements" ON public.partner_statements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "beneficiary view own statements" ON public.partner_statements FOR SELECT TO authenticated
  USING (beneficiary_user_id = auth.uid());

CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number text UNIQUE,
  beneficiary_type text NOT NULL,
  beneficiary_user_id uuid,
  beneficiary_label text,
  partner_id uuid REFERENCES public.partner_profiles(id) ON DELETE SET NULL,
  statement_id uuid REFERENCES public.partner_statements(id) ON DELETE SET NULL,
  amount_paise bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  method text,
  reference text,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for date,
  paid_at timestamptz,
  notes text,
  allocation_ids uuid[] NOT NULL DEFAULT '{}',
  deal_payout_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage settlements" ON public.settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "beneficiary view own settlements" ON public.settlements FOR SELECT TO authenticated
  USING (beneficiary_user_id = auth.uid());

CREATE TRIGGER trg_revenue_imports_updated BEFORE UPDATE ON public.revenue_imports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_royalty_rules_updated BEFORE UPDATE ON public.royalty_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_royalty_runs_updated BEFORE UPDATE ON public.royalty_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_partner_statements_updated BEFORE UPDATE ON public.partner_statements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_settlements_updated BEFORE UPDATE ON public.settlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.finance_revenue_summary AS
SELECT
  date_trunc('month', occurred_on)::date AS month,
  currency,
  channel,
  SUM(gross_amount_paise) AS gross_paise,
  SUM(platform_fee_paise) AS fees_paise,
  SUM(net_amount_paise) AS net_paise,
  COUNT(*) AS line_count
FROM public.revenue_lines
WHERE occurred_on IS NOT NULL
GROUP BY 1,2,3;
GRANT SELECT ON public.finance_revenue_summary TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compute_royalty_run(_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  run record;
  total_gross bigint := 0;
  total_alloc bigint := 0;
  n_lines int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO run FROM public.royalty_runs WHERE id = _run_id;
  IF run IS NULL THEN RAISE EXCEPTION 'run not found'; END IF;
  DELETE FROM public.royalty_allocations WHERE run_id = _run_id AND status = 'draft';
  INSERT INTO public.royalty_allocations
    (run_id, revenue_line_id, rule_id, title_id, deal_memo_id, beneficiary_type, beneficiary_user_id, beneficiary_label, gross_paise, share_pct, allocated_paise, currency, status)
  SELECT
    _run_id, rl.id, r.id, rl.title_id, rl.deal_memo_id,
    r.beneficiary_type, r.beneficiary_user_id, r.beneficiary_label,
    rl.net_amount_paise, r.share_pct,
    FLOOR(rl.net_amount_paise * r.share_pct / 100.0)::bigint,
    rl.currency, 'draft'
  FROM public.revenue_lines rl
  JOIN public.royalty_rules r ON r.active = true AND (
    (r.scope='title'   AND r.title_id = rl.title_id) OR
    (r.scope='deal'    AND r.deal_memo_id = rl.deal_memo_id) OR
    (r.scope='partner' AND r.partner_id = rl.partner_id) OR
    (r.scope='global')
  )
  WHERE rl.occurred_on BETWEEN run.period_start AND run.period_end;
  SELECT COALESCE(SUM(gross_paise),0), COALESCE(SUM(allocated_paise),0), COUNT(*)
    INTO total_gross, total_alloc, n_lines
    FROM public.royalty_allocations WHERE run_id = _run_id;
  UPDATE public.royalty_runs
     SET gross_paise = total_gross, allocated_paise = total_alloc,
         line_count = n_lines, status = 'computed', updated_at = now()
   WHERE id = _run_id;
  RETURN jsonb_build_object('gross_paise', total_gross, 'allocated_paise', total_alloc, 'line_count', n_lines);
END;
$$;
GRANT EXECUTE ON FUNCTION public.compute_royalty_run(uuid) TO authenticated;
