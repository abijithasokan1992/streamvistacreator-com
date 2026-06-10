
-- 1. Allow 'creator' on plan_tier
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_tier_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_plan_tier_check
  CHECK (plan_tier IN ('free','creator','monthly','quarterly','yearly'));

-- 2. Subscriptions: extend for Razorpay
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id text,
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN product_id DROP NOT NULL,
  ALTER COLUMN price_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_razorpay_sub_id_key
  ON public.subscriptions(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- 3. Redemption log
CREATE TABLE IF NOT EXISTS public.premium_invitation_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.premium_invitations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invitation_id, user_id)
);

GRANT SELECT ON public.premium_invitation_redemptions TO authenticated;
GRANT ALL ON public.premium_invitation_redemptions TO service_role;

ALTER TABLE public.premium_invitation_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
  ON public.premium_invitation_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions"
  ON public.premium_invitation_redemptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. grant_creator_role: swap client -> creator, set plan_tier
CREATE OR REPLACE FUNCTION public.grant_creator_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'client';
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'creator')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.user_profiles SET plan_tier = 'creator', updated_at = now()
    WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_creator_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_creator_role(uuid) TO service_role;

-- 5. revoke_creator_role: revert to client/free
CREATE OR REPLACE FUNCTION public.revoke_creator_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'creator';
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'client')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.user_profiles SET plan_tier = 'free', updated_at = now()
    WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_creator_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_creator_role(uuid) TO service_role;

-- 6. Auto-redeem premium invitations on signup
CREATE OR REPLACE FUNCTION public.redeem_premium_invitation_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  target_tb int;
BEGIN
  FOR inv IN
    SELECT id, storage_tb, is_free, account_type
    FROM public.premium_invitations
    WHERE lower(invitee_email) = lower(NEW.email)
      AND status IN ('pending','sent')
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    -- Idempotency guard
    INSERT INTO public.premium_invitation_redemptions (invitation_id, user_id)
    VALUES (inv.id, NEW.id)
    ON CONFLICT (invitation_id, user_id) DO NOTHING;

    -- Mark invitation redeemed
    UPDATE public.premium_invitations
       SET status = 'redeemed',
           redeemed_by = NEW.id,
           redeemed_at = now(),
           updated_at = now()
     WHERE id = inv.id;

    -- Grant creator role + plan
    PERFORM public.grant_creator_role(NEW.id);

    -- Apply storage allowance (>1 TB invites bump topup_tb)
    target_tb := COALESCE(inv.storage_tb, 1);
    IF target_tb > 1 THEN
      UPDATE public.user_profiles
         SET topup_tb = GREATEST(COALESCE(topup_tb, 0), target_tb - 1),
             updated_at = now()
       WHERE user_id = NEW.id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_redeem_premium_invitation ON auth.users;
CREATE TRIGGER on_auth_user_redeem_premium_invitation
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.redeem_premium_invitation_on_signup();
