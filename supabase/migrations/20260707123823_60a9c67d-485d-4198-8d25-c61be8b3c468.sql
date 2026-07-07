-- Fix schema drift on public.plans: anonymous visitors on the Pricing page
-- must be able to read active, non-archived, public plans. Existing policies
-- were scoped to `authenticated` only, causing empty pricing UI for guests.

DROP POLICY IF EXISTS plans_read_public_anon ON public.plans;

CREATE POLICY plans_read_public_anon
ON public.plans
FOR SELECT
TO anon
USING (
  is_active
  AND NOT is_archived
  AND visibility = 'public'
);