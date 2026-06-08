
-- 1. Extend referrals with recurring commission fields
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,4) NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS commission_until timestamptz;

UPDATE public.referrals SET commission_until = created_at + interval '5 years' WHERE commission_until IS NULL;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_reward_type_check;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_reward_type_check
  CHECK (reward_type IS NULL OR reward_type IN ('storage_tb','inr','recurring_revenue'));

-- 2. intro_invites table
CREATE TABLE IF NOT EXISTS public.intro_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12),'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  rate numeric(5,4) NOT NULL DEFAULT 0.10,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS intro_invites_inviter_idx ON public.intro_invites(inviter_user_id);
CREATE INDEX IF NOT EXISTS intro_invites_email_idx ON public.intro_invites(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intro_invites TO authenticated;
GRANT ALL ON public.intro_invites TO service_role;

ALTER TABLE public.intro_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own intro invites"
  ON public.intro_invites FOR ALL
  TO authenticated
  USING (inviter_user_id = auth.uid())
  WITH CHECK (inviter_user_id = auth.uid());

CREATE POLICY "Admins manage all intro invites"
  ON public.intro_invites FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER intro_invites_touch BEFORE UPDATE ON public.intro_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. On new signup: auto-accept matching intro_invites by email
CREATE OR REPLACE FUNCTION public.accept_intro_invite_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.intro_invites
     SET status = 'accepted',
         accepted_user_id = NEW.id,
         accepted_at = now()
   WHERE lower(email) = lower(NEW.email)
     AND status = 'pending'
     AND expires_at > now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_accept_intro ON auth.users;
CREATE TRIGGER on_auth_user_accept_intro
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.accept_intro_invite_on_signup();
