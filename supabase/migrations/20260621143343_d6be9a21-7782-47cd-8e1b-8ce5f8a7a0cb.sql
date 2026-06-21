
-- =========================================================================
-- 11.3A — Payments OS canonical billing foundation (additive only)
-- =========================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.billing_order_status AS ENUM
    ('draft','awaiting_payment','payment_under_review','paid','failed','cancelled','expired','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_payment_rail AS ENUM
    ('razorpay','bank_transfer','upi_manual','invoice_offline','admin_mark_paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_manual_status AS ENUM
    ('submitted','under_review','approved','rejected','needs_clarification');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_attempt_status AS ENUM
    ('initiated','succeeded','failed','expired','refunded','verified','signature_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- billing_apps ----------
CREATE TABLE IF NOT EXISTS public.billing_apps (
  app_key       text PRIMARY KEY,
  display_name  text NOT NULL,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_apps TO authenticated;
GRANT ALL ON public.billing_apps TO service_role;
ALTER TABLE public.billing_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_apps_read ON public.billing_apps FOR SELECT TO authenticated USING (true);
CREATE POLICY billing_apps_admin_write ON public.billing_apps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

INSERT INTO public.billing_apps (app_key, display_name, description) VALUES
  ('streamvista_creator','StreamVista Creator','Creator-facing plans, storage, top-ups'),
  ('studio_vault','Studio Vault','Studio vault storage tiers and top-ups'),
  ('crayons_bridge','Crayons Bridge','B2B licensing / rights / delivery / enterprise commerce'),
  ('crayons_loop','Crayons Loop','OTT / streaming / subscription / transactional')
ON CONFLICT (app_key) DO NOTHING;

-- ---------- billing_products ----------
CREATE TABLE IF NOT EXISTS public.billing_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key         text NOT NULL REFERENCES public.billing_apps(app_key),
  product_key     text NOT NULL,
  product_type    text NOT NULL,
  name            text NOT NULL,
  description     text,
  target_actor    text NOT NULL DEFAULT 'creator',
  billing_mode    text NOT NULL DEFAULT 'one_time',
  currency        text NOT NULL DEFAULT 'INR',
  base_amount_paise bigint NOT NULL DEFAULT 0,
  tax_mode        text NOT NULL DEFAULT 'exclusive',
  tax_rate        numeric NOT NULL DEFAULT 18,
  is_active       boolean NOT NULL DEFAULT true,
  is_self_serve   boolean NOT NULL DEFAULT true,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_key, product_key)
);
GRANT SELECT ON public.billing_products TO authenticated;
GRANT ALL ON public.billing_products TO service_role;
ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_products_read ON public.billing_products FOR SELECT TO authenticated USING (true);
CREATE POLICY billing_products_admin_write ON public.billing_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- billing_price_versions ----------
CREATE TABLE IF NOT EXISTS public.billing_price_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   uuid NOT NULL REFERENCES public.billing_products(id) ON DELETE CASCADE,
  version      int  NOT NULL,
  amount_paise bigint NOT NULL,
  currency     text NOT NULL DEFAULT 'INR',
  tax_rate     numeric NOT NULL DEFAULT 18,
  effective_from timestamptz NOT NULL DEFAULT now(),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version)
);
GRANT SELECT ON public.billing_price_versions TO authenticated;
GRANT ALL ON public.billing_price_versions TO service_role;
ALTER TABLE public.billing_price_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_price_versions_read ON public.billing_price_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY billing_price_versions_admin_write ON public.billing_price_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- billing_payment_method_configs ----------
CREATE TABLE IF NOT EXISTS public.billing_payment_method_configs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_app_key       text REFERENCES public.billing_apps(app_key),
  scope_product_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  rail                public.billing_payment_rail NOT NULL,
  display_name        text NOT NULL,
  beneficiary_name    text,
  bank_name           text,
  account_number      text,
  ifsc                text,
  branch              text,
  upi_id              text,
  qr_image_path       text,
  instructions        text,
  support_contact     text,
  is_enabled          boolean NOT NULL DEFAULT true,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_payment_method_configs TO authenticated;
GRANT ALL ON public.billing_payment_method_configs TO service_role;
ALTER TABLE public.billing_payment_method_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_pmc_read ON public.billing_payment_method_configs FOR SELECT TO authenticated USING (is_enabled);
CREATE POLICY billing_pmc_admin_all ON public.billing_payment_method_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- billing_orders ----------
CREATE TABLE IF NOT EXISTS public.billing_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_key             text NOT NULL REFERENCES public.billing_apps(app_key),
  customer_user_id    uuid,
  customer_org_id     uuid,
  product_id          uuid REFERENCES public.billing_products(id),
  source_type         text NOT NULL,            -- 'studio_vault','creator_payg','creator_plan','bridge_service', etc.
  source_ref_id       uuid,                     -- pointer to existing storage_topups.id / plan_assignments.id / etc.
  amount_subtotal_paise bigint NOT NULL DEFAULT 0,
  amount_tax_paise      bigint NOT NULL DEFAULT 0,
  amount_total_paise    bigint NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'INR',
  status              public.billing_order_status NOT NULL DEFAULT 'awaiting_payment',
  payment_method_mode public.billing_payment_rail NOT NULL DEFAULT 'razorpay',
  invoice_id          uuid REFERENCES public.invoices(id),
  payment_trace_id    uuid REFERENCES public.payment_traces(id),
  notes               text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_orders_customer ON public.billing_orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_billing_orders_source ON public.billing_orders(source_type, source_ref_id);
CREATE INDEX IF NOT EXISTS idx_billing_orders_status ON public.billing_orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_orders_source_ref
  ON public.billing_orders(source_type, source_ref_id)
  WHERE source_ref_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.billing_orders TO authenticated;
GRANT ALL ON public.billing_orders TO service_role;
ALTER TABLE public.billing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_orders_owner_read ON public.billing_orders FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());
CREATE POLICY billing_orders_admin_all ON public.billing_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE POLICY billing_orders_owner_insert ON public.billing_orders FOR INSERT TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

-- ---------- billing_payment_attempts ----------
CREATE TABLE IF NOT EXISTS public.billing_payment_attempts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_order_id         uuid NOT NULL REFERENCES public.billing_orders(id) ON DELETE CASCADE,
  rail                     public.billing_payment_rail NOT NULL,
  status                   public.billing_attempt_status NOT NULL DEFAULT 'initiated',
  amount_paise             bigint NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'INR',
  razorpay_order_id        text,
  razorpay_payment_id      text,
  razorpay_signature_valid boolean,
  utr_or_reference         text,
  failure_reason           text,
  gateway_response         jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by              uuid,
  verified_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bpa_order ON public.billing_payment_attempts(billing_order_id);
CREATE INDEX IF NOT EXISTS idx_bpa_rzp_order ON public.billing_payment_attempts(razorpay_order_id);

GRANT SELECT ON public.billing_payment_attempts TO authenticated;
GRANT ALL ON public.billing_payment_attempts TO service_role;
ALTER TABLE public.billing_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpa_owner_read ON public.billing_payment_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.billing_orders o
                  WHERE o.id = billing_payment_attempts.billing_order_id
                    AND o.customer_user_id = auth.uid()));
CREATE POLICY bpa_admin_all ON public.billing_payment_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- billing_manual_payment_submissions ----------
CREATE TABLE IF NOT EXISTS public.billing_manual_payment_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_order_id    uuid NOT NULL REFERENCES public.billing_orders(id) ON DELETE CASCADE,
  submitted_by_user_id uuid,
  payer_name          text,
  payer_phone         text,
  payer_email         text,
  payment_channel     text NOT NULL,           -- 'bank_transfer','upi','neft','rtgs','imps','gpay','phonepe','cash_deposit','other'
  amount_paid_paise   bigint NOT NULL,
  currency            text NOT NULL DEFAULT 'INR',
  paid_at             timestamptz,
  utr_or_reference    text,
  bank_name           text,
  remarks             text,
  proof_file_path     text,
  status              public.billing_manual_status NOT NULL DEFAULT 'submitted',
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  review_notes        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bmps_order ON public.billing_manual_payment_submissions(billing_order_id);
CREATE INDEX IF NOT EXISTS idx_bmps_status ON public.billing_manual_payment_submissions(status);

GRANT SELECT, INSERT, UPDATE ON public.billing_manual_payment_submissions TO authenticated;
GRANT ALL ON public.billing_manual_payment_submissions TO service_role;
ALTER TABLE public.billing_manual_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY bmps_owner_read ON public.billing_manual_payment_submissions FOR SELECT TO authenticated
  USING (submitted_by_user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.billing_orders o
                     WHERE o.id = billing_manual_payment_submissions.billing_order_id
                       AND o.customer_user_id = auth.uid()));
CREATE POLICY bmps_owner_insert ON public.billing_manual_payment_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by_user_id = auth.uid()
              AND EXISTS (SELECT 1 FROM public.billing_orders o
                           WHERE o.id = billing_manual_payment_submissions.billing_order_id
                             AND o.customer_user_id = auth.uid()));
CREATE POLICY bmps_admin_all ON public.billing_manual_payment_submissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- billing_ledger_events ----------
CREATE TABLE IF NOT EXISTS public.billing_ledger_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_order_id uuid NOT NULL REFERENCES public.billing_orders(id) ON DELETE CASCADE,
  event_type       text NOT NULL,    -- 'order_created','payment_initiated','webhook_captured','proof_uploaded','finance_approved','entitlement_activated','invoice_issued','refund_processed','rejected','clarification_requested'
  actor_user_id    uuid,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ble_order ON public.billing_ledger_events(billing_order_id);
CREATE INDEX IF NOT EXISTS idx_ble_type ON public.billing_ledger_events(event_type);

GRANT SELECT ON public.billing_ledger_events TO authenticated;
GRANT ALL ON public.billing_ledger_events TO service_role;
ALTER TABLE public.billing_ledger_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ble_owner_read ON public.billing_ledger_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.billing_orders o
                  WHERE o.id = billing_ledger_events.billing_order_id
                    AND o.customer_user_id = auth.uid()));
CREATE POLICY ble_admin_all ON public.billing_ledger_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.billing_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['billing_products','billing_payment_method_configs',
                           'billing_orders','billing_payment_attempts',
                           'billing_manual_payment_submissions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_touch BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.billing_touch_updated_at();', t, t);
  END LOOP;
END $$;

-- =========================================================================
-- Adapter: mirror existing storage_topups into billing_orders / attempts
-- =========================================================================
CREATE OR REPLACE FUNCTION public.billing_sync_from_storage_topup(_topup_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t           public.storage_topups%ROWTYPE;
  v_app       text;
  v_source    text;
  v_status    public.billing_order_status;
  v_order_id  uuid;
  v_inv_id    uuid;
  v_trace_id  uuid;
BEGIN
  SELECT * INTO t FROM public.storage_topups WHERE id = _topup_id;
  IF t.id IS NULL THEN RETURN NULL; END IF;

  v_source := COALESCE(t.source, 'creator_payg');
  v_app := CASE WHEN v_source = 'studio_vault' THEN 'studio_vault' ELSE 'streamvista_creator' END;
  v_status := CASE
    WHEN t.status = 'paid' THEN 'paid'::public.billing_order_status
    WHEN t.status = 'failed' THEN 'failed'::public.billing_order_status
    WHEN t.status = 'cancelled' THEN 'cancelled'::public.billing_order_status
    ELSE 'awaiting_payment'::public.billing_order_status
  END;

  SELECT id INTO v_inv_id FROM public.invoices WHERE topup_id = t.id LIMIT 1;
  SELECT id INTO v_trace_id FROM public.payment_traces WHERE order_id = t.razorpay_order_id LIMIT 1;

  INSERT INTO public.billing_orders (
    app_key, customer_user_id, source_type, source_ref_id,
    amount_subtotal_paise, amount_tax_paise, amount_total_paise, currency,
    status, payment_method_mode, invoice_id, payment_trace_id, metadata
  ) VALUES (
    v_app, t.user_id, v_source, t.id,
    COALESCE(t.subtotal_paise, 0), COALESCE(t.gst_paise, 0),
    COALESCE(t.total_paise, COALESCE(t.subtotal_paise,0) + COALESCE(t.gst_paise,0)),
    'INR', v_status, 'razorpay', v_inv_id, v_trace_id,
    jsonb_build_object('tb_added', t.tb_added,
                       'billing_interval_months', t.billing_interval_months,
                       'vault_product_id', t.vault_product_id)
  )
  ON CONFLICT (source_type, source_ref_id) DO UPDATE
    SET status = EXCLUDED.status,
        amount_subtotal_paise = EXCLUDED.amount_subtotal_paise,
        amount_tax_paise = EXCLUDED.amount_tax_paise,
        amount_total_paise = EXCLUDED.amount_total_paise,
        invoice_id = COALESCE(EXCLUDED.invoice_id, public.billing_orders.invoice_id),
        payment_trace_id = COALESCE(EXCLUDED.payment_trace_id, public.billing_orders.payment_trace_id),
        metadata = public.billing_orders.metadata || EXCLUDED.metadata,
        updated_at = now()
  RETURNING id INTO v_order_id;

  IF t.razorpay_order_id IS NOT NULL THEN
    INSERT INTO public.billing_payment_attempts (
      billing_order_id, rail, status, amount_paise, currency,
      razorpay_order_id, razorpay_payment_id
    )
    SELECT v_order_id, 'razorpay'::public.billing_payment_rail,
           CASE WHEN t.status = 'paid' THEN 'succeeded'::public.billing_attempt_status
                WHEN t.status = 'failed' THEN 'failed'::public.billing_attempt_status
                ELSE 'initiated'::public.billing_attempt_status END,
           COALESCE(t.total_paise, 0), 'INR',
           t.razorpay_order_id, t.razorpay_payment_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.billing_payment_attempts a
      WHERE a.billing_order_id = v_order_id
        AND a.razorpay_order_id = t.razorpay_order_id
    );
  END IF;

  RETURN v_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.trg_billing_sync_storage_topup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.billing_sync_from_storage_topup(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block the existing Studio Vault path on adapter failure
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_storage_topups_billing_sync ON public.storage_topups;
CREATE TRIGGER trg_storage_topups_billing_sync
AFTER INSERT OR UPDATE ON public.storage_topups
FOR EACH ROW EXECUTE FUNCTION public.trg_billing_sync_storage_topup();

-- Backfill existing rows
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.storage_topups LOOP
    PERFORM public.billing_sync_from_storage_topup(r.id);
  END LOOP;
END $$;
