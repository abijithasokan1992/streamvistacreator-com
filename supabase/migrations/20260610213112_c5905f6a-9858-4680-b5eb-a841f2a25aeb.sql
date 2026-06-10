CREATE TABLE public.razorpay_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'webhook',
  order_id TEXT,
  payment_id TEXT,
  subscription_id TEXT,
  amount_paise BIGINT,
  currency TEXT,
  status TEXT,
  error_code TEXT,
  error_description TEXT,
  signature_valid BOOLEAN,
  user_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.razorpay_audit_log TO authenticated;
GRANT ALL ON public.razorpay_audit_log TO service_role;

ALTER TABLE public.razorpay_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view razorpay audit log"
  ON public.razorpay_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role writes razorpay audit log"
  ON public.razorpay_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX razorpay_audit_log_created_at_idx ON public.razorpay_audit_log (created_at DESC);
CREATE INDEX razorpay_audit_log_event_type_idx ON public.razorpay_audit_log (event_type);
CREATE INDEX razorpay_audit_log_order_id_idx ON public.razorpay_audit_log (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX razorpay_audit_log_payment_id_idx ON public.razorpay_audit_log (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX razorpay_audit_log_subscription_id_idx ON public.razorpay_audit_log (subscription_id) WHERE subscription_id IS NOT NULL;