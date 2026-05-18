ALTER TABLE public.onboarding_requests
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN razorpay_order_id TEXT,
  ADD COLUMN razorpay_payment_id TEXT,
  ADD COLUMN amount_paid_paise BIGINT;

CREATE INDEX idx_onboarding_razorpay_order ON public.onboarding_requests(razorpay_order_id);