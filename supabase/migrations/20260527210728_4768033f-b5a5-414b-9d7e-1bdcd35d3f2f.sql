
-- 1. New columns
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS mfi_proof_path TEXT;

CREATE INDEX IF NOT EXISTS idx_onboarding_plan_type ON public.onboarding_requests(plan_type);

-- 2. Public seat counter (security definer to bypass RLS for a single aggregate)
CREATE OR REPLACE FUNCTION public.mfi_seats_taken()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.onboarding_requests
  WHERE plan_type = 'mfi_limited';
$$;

REVOKE ALL ON FUNCTION public.mfi_seats_taken() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfi_seats_taken() TO anon, authenticated;

-- 3. Storage bucket for proof uploads (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mfi-proof', 'mfi-proof', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone (anon or authenticated) can upload proof. We restrict size/mime in the
-- Storage bucket settings via policy and on the client; admins moderate after.
DROP POLICY IF EXISTS "Anyone can upload MFI proof" ON storage.objects;
CREATE POLICY "Anyone can upload MFI proof"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'mfi-proof');

DROP POLICY IF EXISTS "Admins read MFI proof" ON storage.objects;
CREATE POLICY "Admins read MFI proof"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mfi-proof' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete MFI proof" ON storage.objects;
CREATE POLICY "Admins delete MFI proof"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mfi-proof' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Update the public insert policy to accept zero-priced MFI free plans.
DROP POLICY IF EXISTS "Public can submit valid onboarding request" ON public.onboarding_requests;
CREATE POLICY "Public can submit valid onboarding request"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(client_name)) BETWEEN 1 AND 200
  AND length(trim(professional_role)) BETWEEN 1 AND 100
  AND (
    (contact_phone IS NOT NULL AND length(trim(contact_phone)) BETWEEN 6 AND 30)
    OR (business_email IS NOT NULL AND business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  )
  AND selected_cycle = ANY (ARRAY['monthly','quarterly','yearly'])
  AND base_price >= 0
  AND final_price >= 0
  AND onboarding_status = 'pending'
  AND plan_type IN ('standard', 'mfi_limited')
);
