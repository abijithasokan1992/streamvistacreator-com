-- Premium invitations with custom voucher logic (admin-issued)
CREATE TABLE public.premium_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  invitee_name TEXT NOT NULL,
  invitee_email TEXT,
  invitee_phone TEXT,
  storage_tb INT NOT NULL DEFAULT 1 CHECK (storage_tb > 0 AND storage_tb <= 1000),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  validity_days INT NOT NULL DEFAULT 30 CHECK (validity_days > 0 AND validity_days <= 3650),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','redeemed','expired','revoked')),
  sent_channels TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_invitations TO authenticated;
GRANT ALL ON public.premium_invitations TO service_role;

ALTER TABLE public.premium_invitations ENABLE ROW LEVEL SECURITY;

-- Admins fully manage
CREATE POLICY "Admins manage invitations"
ON public.premium_invitations FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Invitees can read their own redeemed row
CREATE POLICY "Invitee reads own"
ON public.premium_invitations FOR SELECT
TO authenticated
USING (redeemed_by = auth.uid());

-- updated_at trigger (reuse if exists)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER premium_invitations_touch
BEFORE UPDATE ON public.premium_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
ALTER TABLE public.premium_invitations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.premium_invitations;