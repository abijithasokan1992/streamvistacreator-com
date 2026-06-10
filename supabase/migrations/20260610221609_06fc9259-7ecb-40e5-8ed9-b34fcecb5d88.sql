-- The RESTRICTIVE "Block anon SELECT on onboarding requests" policy neutralises any
-- permissive anon read policy. Drop the dead permissive policy to remove ambiguity.
DROP POLICY IF EXISTS "Anon submitters read own session submission" ON public.onboarding_requests;