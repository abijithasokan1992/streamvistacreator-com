
-- ──────────────────────────────────────────────────────────────────────
-- 1. PLAN CATALOG — seed canonical Free + Creator PAYG 1 TB rows
-- ──────────────────────────────────────────────────────────────────────

-- The plans table already exists; ensure missing columns we rely on exist.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id text,
  ADD COLUMN IF NOT EXISTS topup_unit_tb numeric;

-- Seed Free plan (50 GB live cap) — id stable so app code can lookup by code.
INSERT INTO public.plans (
  code, name, description, role, currency, price_amount, gst_percent,
  billing_cycle, storage_gb, bandwidth_gb, user_limit, features,
  is_active, is_archived, visibility, sort_order
) VALUES (
  'free',
  'Basic Free',
  'Get started with 50 GB of storage. Pay only if your monthly bandwidth crosses 500 GB.',
  'content_owner',
  'INR', 0, 0, 'lifetime',
  50, 500, 1,
  jsonb_build_object(
    'storage_gb', 50,
    'bandwidth_gb', 500,
    'bandwidth_overage_inr_per_gb', 10,
    'review_links', true,
    'share_links', true
  ),
  true, false, 'public', 10
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_amount = EXCLUDED.price_amount,
  storage_gb = EXCLUDED.storage_gb,
  bandwidth_gb = EXCLUDED.bandwidth_gb,
  features = EXCLUDED.features,
  is_active = true,
  is_archived = false,
  updated_at = now();

-- Seed Creator PAYG plan — 1 TB at ₹650 + 18% GST. Each additional TB is sold
-- as the same plan via top-up. razorpay_plan_id is left NULL by default and is
-- set later via the admin UI when the Razorpay plan is created in the dashboard.
INSERT INTO public.plans (
  code, name, description, role, currency, price_amount, gst_percent,
  billing_cycle, storage_gb, bandwidth_gb, user_limit, features,
  topup_unit_tb, is_active, is_archived, visibility, sort_order
) VALUES (
  'creator_payg_1tb',
  'Creator — 1 TB Pay-As-You-Go',
  '1 TB of cinema-grade storage at ₹650 + 18% GST per month. Includes master content storage, submission, review, and delivery workspaces. Each extra TB adds at the same price.',
  'content_owner',
  'INR', 650, 18, 'monthly',
  1024, 5000, 5,
  jsonb_build_object(
    'master_storage', true,
    'submission_workflow', true,
    'review_workflow', true,
    'ott_preparation', true,
    'delivery_preparation', true,
    'auto_topup', true,
    'frame_accurate_review', true,
    'camera_to_cloud', true
  ),
  1, true, false, 'public', 20
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_amount = EXCLUDED.price_amount,
  gst_percent = EXCLUDED.gst_percent,
  storage_gb = EXCLUDED.storage_gb,
  features = EXCLUDED.features,
  topup_unit_tb = EXCLUDED.topup_unit_tb,
  is_active = true,
  is_archived = false,
  updated_at = now();

-- Plans must be readable by all signed-in users so the pricing page and
-- admin catalog can render without a service-role round-trip.
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL    ON public.plans TO service_role;

-- Storage allocations need authenticated read for the user's own row.
GRANT SELECT ON public.storage_allocations TO authenticated;
GRANT ALL    ON public.storage_allocations TO service_role;
DROP POLICY IF EXISTS "users read own storage allocation" ON public.storage_allocations;
CREATE POLICY "users read own storage allocation"
  ON public.storage_allocations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- plan_assignments needs authenticated read for the user's own row.
GRANT SELECT ON public.plan_assignments TO authenticated;
GRANT ALL    ON public.plan_assignments TO service_role;
DROP POLICY IF EXISTS "users read own plan assignment" ON public.plan_assignments;
CREATE POLICY "users read own plan assignment"
  ON public.plan_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────────
-- 2. INVOICES — canonical billing record + numbering
-- ──────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  text UNIQUE NOT NULL DEFAULT (
    'INV-' || to_char(now(),'YYYYMM') || '-' ||
    lpad(nextval('public.invoice_number_seq')::text, 6, '0')
  ),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan_id         uuid REFERENCES public.plans(id),
  topup_id        uuid REFERENCES public.storage_topups(id),
  subscription_id uuid REFERENCES public.subscriptions(id),
  source          text NOT NULL CHECK (source IN ('topup','subscription','manual')),
  description     text NOT NULL,
  currency        text NOT NULL DEFAULT 'INR',
  subtotal_paise  bigint NOT NULL CHECK (subtotal_paise >= 0),
  gst_percent     numeric NOT NULL DEFAULT 18,
  gst_paise       bigint NOT NULL CHECK (gst_paise >= 0),
  total_paise     bigint NOT NULL CHECK (total_paise >= 0),
  status          text NOT NULL DEFAULT 'paid'
                  CHECK (status IN ('draft','paid','void','refunded')),
  razorpay_order_id   text,
  razorpay_payment_id text,
  billed_to_email text,
  billed_to_name  text,
  issued_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_user_idx     ON public.invoices(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS invoices_topup_idx    ON public.invoices(topup_id);
CREATE INDEX IF NOT EXISTS invoices_payment_idx  ON public.invoices(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS invoices_issued_idx   ON public.invoices(issued_at DESC);

GRANT SELECT          ON public.invoices TO authenticated;
GRANT ALL             ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins read all invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));

CREATE TRIGGER invoices_touch_updated
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 3. ENTITLEMENT PROJECTION — canonical write path
-- ──────────────────────────────────────────────────────────────────────
-- Called by the verify-storage-topup edge function and the razorpay-webhook
-- after a top-up is confirmed paid. Idempotent: re-running for the same
-- topup_id is safe.
CREATE OR REPLACE FUNCTION public.project_topup_entitlement(_topup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t          public.storage_topups%ROWTYPE;
  creator_plan_id uuid;
  alloc_id   uuid;
  inv_row    public.invoices%ROWTYPE;
  user_email text;
  tb_int     int;
  gb_to_add  int;
  subtotal   bigint;
  gst        bigint;
  total      bigint;
BEGIN
  SELECT * INTO t FROM public.storage_topups WHERE id = _topup_id;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'topup % not found', _topup_id USING ERRCODE='P0002';
  END IF;
  IF t.status <> 'paid' THEN
    RAISE EXCEPTION 'topup % is not paid (status=%)', _topup_id, t.status USING ERRCODE='22023';
  END IF;

  SELECT id INTO creator_plan_id FROM public.plans WHERE code='creator_payg_1tb' LIMIT 1;
  IF creator_plan_id IS NULL THEN
    RAISE EXCEPTION 'creator_payg_1tb plan not seeded' USING ERRCODE='P0002';
  END IF;

  tb_int    := GREATEST(1, COALESCE(t.tb_added,1)::int);
  gb_to_add := tb_int * 1024;

  -- 1. plan_assignments — ensure an active Creator assignment exists.
  INSERT INTO public.plan_assignments (user_id, plan_id, status, starts_at, notes)
  VALUES (t.user_id, creator_plan_id, 'active', now(), 'auto: topup '||t.id)
  ON CONFLICT DO NOTHING;

  -- 2. storage_allocations — accumulate the purchased TB.
  SELECT id INTO alloc_id
    FROM public.storage_allocations
   WHERE user_id = t.user_id AND source = 'creator_payg'
   ORDER BY created_at ASC LIMIT 1;

  IF alloc_id IS NULL THEN
    INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, notes)
    VALUES (t.user_id, gb_to_add, 0, 'creator_payg', 'auto: first topup '||t.id);
  ELSE
    UPDATE public.storage_allocations
       SET allocated_gb = allocated_gb + gb_to_add,
           updated_at = now()
     WHERE id = alloc_id;
  END IF;

  -- 3. Legacy mirror so existing UI keeps working.
  UPDATE public.user_profiles
     SET plan_tier = 'creator',
         topup_tb  = GREATEST(COALESCE(topup_tb,0), tb_int),
         updated_at = now()
   WHERE user_id = t.user_id;

  -- 4. Invoice — one per topup. Subtotal = base price * TB; GST 18%.
  SELECT * INTO inv_row FROM public.invoices WHERE topup_id = t.id LIMIT 1;
  IF inv_row.id IS NULL THEN
    subtotal := 65000::bigint * tb_int;        -- ₹650 per TB in paise
    gst      := round(subtotal * 0.18)::bigint;
    total    := subtotal + gst;
    SELECT email INTO user_email FROM auth.users WHERE id = t.user_id;
    INSERT INTO public.invoices (
      user_id, plan_id, topup_id, source, description,
      subtotal_paise, gst_percent, gst_paise, total_paise,
      razorpay_order_id, razorpay_payment_id, billed_to_email
    ) VALUES (
      t.user_id, creator_plan_id, t.id, 'topup',
      'Creator Plan — '||tb_int||' TB storage (Pay-As-You-Go)',
      subtotal, 18, gst, total,
      t.razorpay_order_id, t.razorpay_payment_id, user_email
    ) RETURNING * INTO inv_row;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'plan_id', creator_plan_id,
    'tb_added', tb_int,
    'invoice_id', inv_row.id,
    'invoice_number', inv_row.invoice_number
  );
END;
$$;

REVOKE ALL ON FUNCTION public.project_topup_entitlement(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.project_topup_entitlement(uuid) TO service_role;

-- ──────────────────────────────────────────────────────────────────────
-- 4. PAYMENT SECURITY EVENTS — view over existing payment_debug_logs
-- ──────────────────────────────────────────────────────────────────────
-- The taxonomy is enforced by convention in the edge functions, which write
-- action_type values matching the LIKE pattern below.
CREATE OR REPLACE VIEW public.payment_security_events AS
SELECT
  id, created_at, severity, action_type, source,
  user_id, order_id, payment_id, event_id,
  error_message, duration_ms, extra,
  CASE
    WHEN action_type = 'webhook.signature' AND severity='ERROR' THEN 'invalid_signature'
    WHEN action_type = 'webhook.replay_skipped'                 THEN 'duplicate_event'
    WHEN action_type = 'webhook.replay_attempt'                 THEN 'replay_attempt'
    WHEN action_type = 'webhook.idempotency_conflict'           THEN 'idempotency_conflict'
    WHEN action_type = 'entitlement.projection_failed'          THEN 'entitlement_projection_failure'
    WHEN action_type = 'subscription.mapping_failed'            THEN 'subscription_mapping_failure'
    WHEN action_type = 'invoice.mismatch'                       THEN 'invoice_mismatch'
    WHEN action_type = 'payment.amount_mismatch'                THEN 'amount_mismatch'
    WHEN action_type = 'webhook.parse_failed'                   THEN 'webhook_parse_failure'
    WHEN action_type = 'payment.unknown_mapping'                THEN 'unknown_payment_mapping'
    ELSE NULL
  END AS event_category
FROM public.payment_debug_logs
WHERE action_type IN (
  'webhook.signature',
  'webhook.replay_skipped',
  'webhook.replay_attempt',
  'webhook.idempotency_conflict',
  'entitlement.projection_failed',
  'subscription.mapping_failed',
  'invoice.mismatch',
  'payment.amount_mismatch',
  'webhook.parse_failed',
  'payment.unknown_mapping'
);

GRANT SELECT ON public.payment_security_events TO authenticated;
GRANT SELECT ON public.payment_security_events TO service_role;
