CREATE TABLE public.fastlink_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_inr NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  status TEXT NOT NULL DEFAULT 'pending',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  context TEXT NOT NULL DEFAULT 'recovery_fastlink',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fastlink_payments TO authenticated;
GRANT ALL ON public.fastlink_payments TO service_role;

ALTER TABLE public.fastlink_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fastlink payments"
  ON public.fastlink_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_fastlink_payments_user ON public.fastlink_payments(user_id, created_at DESC);
CREATE INDEX idx_fastlink_payments_order ON public.fastlink_payments(razorpay_order_id);

CREATE TRIGGER fastlink_payments_touch
  BEFORE UPDATE ON public.fastlink_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();