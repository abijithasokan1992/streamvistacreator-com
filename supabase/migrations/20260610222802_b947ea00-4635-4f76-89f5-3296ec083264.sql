-- =====================================================================
-- 1. razorpay_webhook_ledger (idempotency + retry queue)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.razorpay_webhook_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  event_type text,
  payment_id text,
  order_id text,
  subscription_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processed','failed')),
  signature_valid boolean,
  payload jsonb NOT NULL,
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.razorpay_webhook_ledger TO authenticated;
GRANT ALL ON public.razorpay_webhook_ledger TO service_role;

ALTER TABLE public.razorpay_webhook_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read razorpay_webhook_ledger"
  ON public.razorpay_webhook_ledger
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS razorpay_webhook_ledger_status_idx
  ON public.razorpay_webhook_ledger (status, created_at DESC);
CREATE INDEX IF NOT EXISTS razorpay_webhook_ledger_payment_idx
  ON public.razorpay_webhook_ledger (payment_id);
CREATE INDEX IF NOT EXISTS razorpay_webhook_ledger_order_idx
  ON public.razorpay_webhook_ledger (order_id);

DROP TRIGGER IF EXISTS razorpay_webhook_ledger_touch ON public.razorpay_webhook_ledger;
CREATE TRIGGER razorpay_webhook_ledger_touch
BEFORE UPDATE ON public.razorpay_webhook_ledger
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 2. payment_debug_logs (structured telemetry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payment_debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'INFO'
    CHECK (severity IN ('INFO','WARN','ERROR')),
  action_type text NOT NULL,
  source text NOT NULL DEFAULT 'edge', -- edge | frontend | webhook | admin
  user_id uuid,
  order_id text,
  payment_id text,
  event_id text,
  error_message text,
  duration_ms int,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_debug_logs TO authenticated;
GRANT ALL ON public.payment_debug_logs TO service_role;

ALTER TABLE public.payment_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read payment_debug_logs"
  ON public.payment_debug_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users may insert their own frontend telemetry rows
-- (source='frontend'); user_id must match the caller and no privileged
-- fields can be spoofed.
CREATE POLICY "Users insert own frontend telemetry"
  ON public.payment_debug_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'frontend'
    AND user_id = auth.uid()
    AND severity IN ('INFO','WARN','ERROR')
  );

CREATE INDEX IF NOT EXISTS payment_debug_logs_ts_idx
  ON public.payment_debug_logs (ts DESC);
CREATE INDEX IF NOT EXISTS payment_debug_logs_action_idx
  ON public.payment_debug_logs (action_type, ts DESC);
CREATE INDEX IF NOT EXISTS payment_debug_logs_order_idx
  ON public.payment_debug_logs (order_id);
CREATE INDEX IF NOT EXISTS payment_debug_logs_payment_idx
  ON public.payment_debug_logs (payment_id);
CREATE INDEX IF NOT EXISTS payment_debug_logs_severity_idx
  ON public.payment_debug_logs (severity, ts DESC);