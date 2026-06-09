-- 1) Generated boolean so the UI can show "password protected?" without
--    selecting the hash itself.
ALTER TABLE public.shared_files
  ADD COLUMN IF NOT EXISTS has_password boolean
  GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED;

-- 2) Hide cryptographic material from anon/authenticated. service_role keeps
--    full access (edge functions use service_role).
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM anon;
REVOKE SELECT (password_hash, password_salt) ON public.shared_files FROM authenticated;
REVOKE UPDATE (password_hash, password_salt) ON public.shared_files FROM anon;
REVOKE UPDATE (password_hash, password_salt) ON public.shared_files FROM authenticated;
REVOKE INSERT (password_hash, password_salt) ON public.shared_files FROM anon;
REVOKE INSERT (password_hash, password_salt) ON public.shared_files FROM authenticated;

-- 3) onboarding_requests: prevent client-side forging of payment fields.
--    Revoke INSERT/UPDATE on payment columns from anon/authenticated. The
--    payments webhook (service_role) is unaffected.
REVOKE INSERT (payment_status, razorpay_order_id, razorpay_payment_id, amount_paid_paise, onboarding_status)
  ON public.onboarding_requests FROM anon, authenticated;
REVOKE UPDATE (payment_status, razorpay_order_id, razorpay_payment_id, amount_paid_paise)
  ON public.onboarding_requests FROM anon, authenticated;