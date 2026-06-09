CREATE TABLE IF NOT EXISTS public.razorpay_config (
  id boolean PRIMARY KEY DEFAULT true,
  key_id text,
  key_secret text,
  webhook_secret text,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT razorpay_config_singleton CHECK (id = true)
);

GRANT SELECT, INSERT, UPDATE ON public.razorpay_config TO authenticated;
GRANT ALL ON public.razorpay_config TO service_role;

ALTER TABLE public.razorpay_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read razorpay_config"
  ON public.razorpay_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert razorpay_config"
  ON public.razorpay_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update razorpay_config"
  ON public.razorpay_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER razorpay_config_touch
  BEFORE UPDATE ON public.razorpay_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.razorpay_config (id, mode) VALUES (true, 'test')
  ON CONFLICT (id) DO NOTHING;