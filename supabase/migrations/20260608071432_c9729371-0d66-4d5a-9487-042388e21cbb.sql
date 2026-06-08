
CREATE OR REPLACE FUNCTION public.attach_referral(_code TEXT, _email TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  inviter UUID;
  existing UUID;
  new_id UUID;
  norm TEXT := upper(trim(_code));
BEGIN
  IF uid IS NULL OR norm IS NULL OR norm = '' THEN
    RETURN NULL;
  END IF;

  SELECT user_id INTO inviter FROM public.referral_codes WHERE upper(code) = norm LIMIT 1;
  IF inviter IS NULL OR inviter = uid THEN
    RETURN NULL;
  END IF;

  SELECT id INTO existing FROM public.referrals WHERE referred_user_id = uid LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referrer_code, referred_user_id, referred_email, status, reward_amount)
  VALUES (inviter, norm, uid, _email, 'pending', 0)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.attach_referral(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_referral(TEXT, TEXT) TO authenticated;
