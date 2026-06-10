CREATE TABLE public.usage_meters (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  storage_gb NUMERIC(14,3) NOT NULL DEFAULT 0,
  bandwidth_gb NUMERIC(14,3) NOT NULL DEFAULT 0,
  api_calls BIGINT NOT NULL DEFAULT 0,
  last_recomputed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_meters TO authenticated;
GRANT ALL ON public.usage_meters TO service_role;
ALTER TABLE public.usage_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own meter" ON public.usage_meters FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all meters" ON public.usage_meters FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_usage_meters_touch BEFORE UPDATE ON public.usage_meters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.usage_overages (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('storage','bandwidth','api')),
  units NUMERIC(14,3) NOT NULL,
  rate_paise INTEGER NOT NULL,
  amount_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','charged','failed','waived')),
  charge_provider TEXT,
  charge_ref TEXT,
  failure_reason TEXT,
  charged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start, kind)
);
CREATE INDEX idx_usage_overages_status ON public.usage_overages(status, created_at);
CREATE INDEX idx_usage_overages_user ON public.usage_overages(user_id, period_start);
GRANT SELECT ON public.usage_overages TO authenticated;
GRANT ALL ON public.usage_overages TO service_role;
ALTER TABLE public.usage_overages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own overages" ON public.usage_overages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all overages" ON public.usage_overages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_usage_overages_touch BEFORE UPDATE ON public.usage_overages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.billing_config (
  id INTEGER NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_charge_enabled BOOLEAN NOT NULL DEFAULT false,
  storage_rate_paise_per_gb INTEGER NOT NULL DEFAULT 75,
  bandwidth_rate_paise_per_gb INTEGER NOT NULL DEFAULT 10,
  api_rate_paise_per_1k INTEGER NOT NULL DEFAULT 0,
  idle_flag_days INTEGER NOT NULL DEFAULT 90,
  idle_freeze_days INTEGER NOT NULL DEFAULT 120,
  free_tier_gb NUMERIC(10,2) NOT NULL DEFAULT 5,
  creator_tier_tb NUMERIC(6,2) NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.billing_config (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.billing_config TO authenticated;
GRANT ALL ON public.billing_config TO service_role;
ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read config" ON public.billing_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update config" ON public.billing_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_billing_config_touch BEFORE UPDATE ON public.billing_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idle_status TEXT NOT NULL DEFAULT 'active' CHECK (idle_status IN ('active','flagged','frozen')),
  ADD COLUMN IF NOT EXISTS idle_flagged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idle_frozen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_user_profiles_idle ON public.user_profiles(idle_status, last_active_at);

CREATE OR REPLACE VIEW public.v_kammattam_meter AS
WITH realised AS (
  SELECT
    COALESCE((SELECT SUM(amount_paid_paise)::bigint FROM public.onboarding_requests WHERE payment_status = 'paid'), 0)
    + COALESCE((SELECT (SUM(amount_inr) * 100)::bigint FROM public.storage_topups WHERE status = 'paid'), 0)
    + COALESCE((SELECT (SUM(amount_inr) * 100)::bigint FROM public.fastlink_payments WHERE status = 'paid'), 0)
    + COALESCE((SELECT SUM(amount_paise)::bigint FROM public.usage_overages WHERE status = 'charged'), 0)
    AS black_paise
),
trapped AS (
  SELECT
    COALESCE((SELECT (SUM(amount_inr) * 100)::bigint FROM public.storage_topups WHERE status IN ('pending','failed')), 0)
    + COALESCE((SELECT (SUM(amount_inr) * 100)::bigint FROM public.fastlink_payments WHERE status IN ('pending','failed')), 0)
    + COALESCE((SELECT SUM(amount_paise)::bigint FROM public.usage_overages WHERE status IN ('pending','failed')), 0)
    AS white_paise
)
SELECT realised.black_paise, trapped.white_paise FROM realised, trapped;
GRANT SELECT ON public.v_kammattam_meter TO authenticated;