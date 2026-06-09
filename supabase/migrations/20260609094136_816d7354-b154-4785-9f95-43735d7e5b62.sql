
-- 1. Update Free Tier defaults to 128 GB / 500 GB bandwidth / ₹10 per overage GB
ALTER TABLE public.free_tier_config
  ADD COLUMN IF NOT EXISTS bandwidth_gb numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bandwidth_overage_inr_per_gb numeric NOT NULL DEFAULT 10;

UPDATE public.free_tier_config
   SET storage_gb = 128,
       bandwidth_gb = 500,
       bandwidth_overage_inr_per_gb = 10,
       notes = 'Free tier: 128 GB storage + 500 GB/month bandwidth. Overage billed at ₹10/GB.'
 WHERE is_active = true;

-- 2. Usage / PAYG fields on user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS storage_used_mb bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_used_mb bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS topup_tb numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bandwidth_quota_gb numeric NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS bandwidth_overage_inr_per_gb numeric NOT NULL DEFAULT 10;

-- 3. Storage top-ups (Pay-As-You-Go ledger)
CREATE TABLE IF NOT EXISTS public.storage_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tb_added numeric NOT NULL DEFAULT 1,
  amount_inr numeric NOT NULL DEFAULT 767,
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed | refunded
  razorpay_order_id text,
  razorpay_payment_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storage_topups TO authenticated;
GRANT ALL ON public.storage_topups TO service_role;

ALTER TABLE public.storage_topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own topups" ON public.storage_topups;
CREATE POLICY "Users view own topups"
ON public.storage_topups FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage topups" ON public.storage_topups;
CREATE POLICY "Admins manage topups"
ON public.storage_topups FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_storage_topups_user ON public.storage_topups(user_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_storage_topups_updated ON public.storage_topups;
CREATE TRIGGER trg_storage_topups_updated
BEFORE UPDATE ON public.storage_topups
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
