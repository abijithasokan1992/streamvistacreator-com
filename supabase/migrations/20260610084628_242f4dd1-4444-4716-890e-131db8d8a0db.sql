
-- Add admin SELECT policy on fastlink_payments for audit visibility
CREATE POLICY "Admins can view all fastlink payments"
  ON public.fastlink_payments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tighten onboarding_requests INSERT: prevent submitters from pre-populating payment confirmation fields
DROP POLICY IF EXISTS "Anyone can submit onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Anyone can create onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Anon and authenticated can submit onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Public can submit onboarding requests" ON public.onboarding_requests;

CREATE POLICY "Public can submit onboarding requests"
  ON public.onboarding_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    razorpay_payment_id IS NULL
    AND razorpay_order_id IS NULL
    AND amount_paid_paise IS NULL
    AND payment_status IN ('pending','unpaid')
    AND onboarding_status = 'pending'
  );
