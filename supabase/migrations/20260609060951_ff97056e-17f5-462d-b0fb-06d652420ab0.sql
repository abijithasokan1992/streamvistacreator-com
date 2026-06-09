DROP POLICY IF EXISTS "Public can view active free tier config" ON public.free_tier_config;
CREATE POLICY "Public can view active free tier config"
ON public.free_tier_config
FOR SELECT
TO anon, authenticated
USING (is_active = true);

GRANT SELECT ON public.free_tier_config TO anon;

DROP POLICY IF EXISTS "Referred users see their own referral" ON public.referrals;
CREATE POLICY "Referred users see their own referral"
ON public.referrals
FOR SELECT
TO authenticated
USING (referred_user_id = auth.uid());