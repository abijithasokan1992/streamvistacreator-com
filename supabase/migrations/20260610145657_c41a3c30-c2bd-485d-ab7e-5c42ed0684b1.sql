
-- 1. intro_invites: remove restrictive SELECT policy that blocks inviters from reading their own rows
DROP POLICY IF EXISTS "Only admins may read intro invite rows" ON public.intro_invites;

CREATE POLICY "Inviters can read their intro invites"
  ON public.intro_invites
  FOR SELECT
  TO authenticated
  USING (inviter_user_id = auth.uid());

-- 2. review_links: add admin SELECT for moderation
CREATE POLICY "Admins can read all review links"
  ON public.review_links
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. razorpay_config: stop storing payment gateway secrets in DB
ALTER TABLE public.razorpay_config DROP COLUMN IF EXISTS key_secret;
ALTER TABLE public.razorpay_config DROP COLUMN IF EXISTS webhook_secret;

-- 4. review_links: track which hashing algorithm was used so legacy SHA-256 hashes
--    can be migrated to PBKDF2 on next successful unlock.
ALTER TABLE public.review_links
  ADD COLUMN IF NOT EXISTS password_hash_algo text NOT NULL DEFAULT 'sha256';
