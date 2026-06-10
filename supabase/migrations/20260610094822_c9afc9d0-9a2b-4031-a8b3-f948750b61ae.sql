
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS linked_share_token text,
  ADD COLUMN IF NOT EXISTS linked_file_id uuid REFERENCES public.shared_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS link_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS link_source text;

ALTER TABLE public.onboarding_requests
  DROP CONSTRAINT IF EXISTS onboarding_requests_link_status_check;
ALTER TABLE public.onboarding_requests
  ADD CONSTRAINT onboarding_requests_link_status_check
  CHECK (link_status IN ('none','linked','revoked','expired','invalid'));

CREATE INDEX IF NOT EXISTS idx_onboarding_linked_share_token
  ON public.onboarding_requests (linked_share_token)
  WHERE linked_share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_onboarding_linked_file_id
  ON public.onboarding_requests (linked_file_id)
  WHERE linked_file_id IS NOT NULL;

-- Refresh the public-insert policy so the new link fields are allowed for anonymous submitters.
DROP POLICY IF EXISTS "Public can submit onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Public can submit onboarding requests"
  ON public.onboarding_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    razorpay_payment_id IS NULL
    AND razorpay_order_id IS NULL
    AND amount_paid_paise IS NULL
    AND payment_status IN ('pending','unpaid','free')
    AND onboarding_status IN ('pending','linked')
    AND link_status IN ('none','linked')
  );
