
-- ============ onboarding_requests ============
DROP POLICY IF EXISTS onboarding_requests_owner_isolation ON public.onboarding_requests;

-- Owner UPDATE limited: sensitive fields must remain unchanged unless admin/service_role
CREATE POLICY onboarding_requests_owner_update
ON public.onboarding_requests
FOR UPDATE
TO authenticated
USING (submitter_user_id = auth.uid())
WITH CHECK (
  submitter_user_id = auth.uid()
  AND payment_status         IS NOT DISTINCT FROM (SELECT o.payment_status         FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND onboarding_status      IS NOT DISTINCT FROM (SELECT o.onboarding_status      FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND access_code            IS NOT DISTINCT FROM (SELECT o.access_code            FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND final_price            IS NOT DISTINCT FROM (SELECT o.final_price            FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND base_price             IS NOT DISTINCT FROM (SELECT o.base_price             FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND promo_code             IS NOT DISTINCT FROM (SELECT o.promo_code             FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND razorpay_order_id      IS NOT DISTINCT FROM (SELECT o.razorpay_order_id      FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
  AND razorpay_payment_id    IS NOT DISTINCT FROM (SELECT o.razorpay_payment_id    FROM public.onboarding_requests o WHERE o.id = onboarding_requests.id)
);

-- ============ hard_disk_intakes ============
DROP POLICY IF EXISTS hdi_owner_isolation ON public.hard_disk_intakes;

-- Keep existing narrow INSERT/UPDATE/SELECT policies. Add explicit owner SELECT (in case narrow one was tied to combined).
-- The existing "Studios can update their own pending hard disk intakes" already restricts to status='submitted' with WITH CHECK auth.uid()=user_id.
-- Add a WITH CHECK guard that also prevents status/admin_notes tampering on that policy path.
DROP POLICY IF EXISTS "Studios can update their own pending hard disk intakes" ON public.hard_disk_intakes;
CREATE POLICY "Studios can update their own pending hard disk intakes"
ON public.hard_disk_intakes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'submitted')
WITH CHECK (
  auth.uid() = user_id
  AND status = 'submitted'
  AND admin_notes IS NOT DISTINCT FROM (SELECT h.admin_notes FROM public.hard_disk_intakes h WHERE h.id = hard_disk_intakes.id)
);
