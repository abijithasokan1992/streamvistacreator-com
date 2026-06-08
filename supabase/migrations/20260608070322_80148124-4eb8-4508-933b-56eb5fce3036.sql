
-- 1) Add referral_code to premium_invitations
ALTER TABLE public.premium_invitations
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE
  DEFAULT encode(extensions.gen_random_bytes(6), 'hex');

UPDATE public.premium_invitations
  SET referral_code = encode(extensions.gen_random_bytes(6), 'hex')
  WHERE referral_code IS NULL;

-- 2) referral_codes: one per user
CREATE TABLE IF NOT EXISTS public.referral_codes (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referral code" ON public.referral_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own referral code" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins read all referral codes" ON public.referral_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3) referrals: tracked + rewarded by admin
CREATE TABLE IF NOT EXISTS public.referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer_code     text NOT NULL,
  referred_email    text,
  referred_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  reward_type       text CHECK (reward_type IN ('storage_tb','inr')),
  reward_amount     numeric(12,2) NOT NULL DEFAULT 0,
  note              text,
  approved_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL    ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE POLICY "Admins manage referrals" ON public.referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER referrals_touch
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS referrals_referrer_user_idx ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_referrer_code_idx ON public.referrals(referrer_code);
