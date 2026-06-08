
CREATE TABLE public.free_tier_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  label TEXT NOT NULL DEFAULT 'Free Tier',
  storage_gb NUMERIC NOT NULL DEFAULT 5,
  duration_days INTEGER NOT NULL DEFAULT 30,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_tier_config TO authenticated;
GRANT ALL ON public.free_tier_config TO service_role;

ALTER TABLE public.free_tier_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view free tier config"
  ON public.free_tier_config FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert free tier config"
  ON public.free_tier_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update free tier config"
  ON public.free_tier_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete free tier config"
  ON public.free_tier_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER free_tier_config_touch
  BEFORE UPDATE ON public.free_tier_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.free_tier_config (label, storage_gb, duration_days, amount, currency, notes)
VALUES ('Free Tier', 5, 30, 0, 'INR', 'Default plan auto-assigned to every new sign-up. Edit values here to update what all new users receive.');
