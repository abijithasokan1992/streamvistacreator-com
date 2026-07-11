
-- 1) members: self-read by email + keep admin full access
DROP POLICY IF EXISTS "Members can read their own record" ON public.members;
CREATE POLICY "Members can read their own record"
ON public.members
FOR SELECT
TO authenticated
USING (
  email IS NOT NULL
  AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
);
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;

-- 2) onboarding_requests: consolidate submitter-scoped read
DROP POLICY IF EXISTS "Submitters can view their own onboarding requests" ON public.onboarding_requests;
DROP POLICY IF EXISTS "Submitters read own by email" ON public.onboarding_requests;
CREATE POLICY "Submitters read own onboarding request"
ON public.onboarding_requests
FOR SELECT
TO authenticated
USING (
  submitter_user_id = auth.uid()
  OR (
    business_email IS NOT NULL
    AND lower(business_email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
);
ALTER TABLE public.onboarding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_requests FORCE ROW LEVEL SECURITY;

-- 3) distribution_program_offers: workspace-scoped read
DROP POLICY IF EXISTS "dpo_workspace_read" ON public.distribution_program_offers;
CREATE POLICY "dpo_workspace_read"
ON public.distribution_program_offers
FOR SELECT
TO authenticated
USING (
  workspace_id IS NOT NULL
  AND public.is_workspace_member(workspace_id, auth.uid())
);
ALTER TABLE public.distribution_program_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_program_offers FORCE ROW LEVEL SECURITY;

-- 4) contact_messages: enforce RLS, no anon read
REVOKE SELECT ON public.contact_messages FROM anon;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages FORCE ROW LEVEL SECURITY;
