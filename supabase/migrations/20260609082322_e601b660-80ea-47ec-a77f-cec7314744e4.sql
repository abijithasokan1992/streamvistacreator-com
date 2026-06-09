
-- Linear onboarding: track each user's onboarding step
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_step text NOT NULL DEFAULT 'profile',
  ADD COLUMN IF NOT EXISTS professional_role text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_onboarding_step_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_onboarding_step_check
  CHECK (onboarding_step IN ('profile','plan','done'));

-- Lightweight RPC: lets any authed user check whether at least one admin exists
-- so the UI can hide the "Claim Admin Role" button when it would just fail.
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated, anon;

-- Backfill: any existing user with a display_name + plan_tier != 'free'
-- (i.e. already provisioned) is considered fully onboarded.
UPDATE public.user_profiles
   SET onboarding_step = 'done'
 WHERE onboarding_step = 'profile'
   AND display_name IS NOT NULL
   AND plan_tier IS NOT NULL;
