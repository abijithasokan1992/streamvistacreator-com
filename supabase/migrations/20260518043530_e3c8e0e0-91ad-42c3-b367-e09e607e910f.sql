CREATE TABLE public.onboarding_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  professional_role TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  selected_cycle TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  final_price NUMERIC NOT NULL,
  promo_code TEXT,
  access_code TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit onboarding request"
ON public.onboarding_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);