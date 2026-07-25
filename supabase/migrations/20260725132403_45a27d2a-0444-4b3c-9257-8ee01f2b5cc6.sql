
CREATE TABLE public.buyer_offer_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('bulk_approve','bulk_sendback')),
  offer_ids UUID[] NOT NULL DEFAULT '{}',
  outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  succeeded INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.buyer_offer_audit_log TO authenticated;
GRANT ALL ON public.buyer_offer_audit_log TO service_role;

ALTER TABLE public.buyer_offer_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Privileged staff can view buyer offer audit"
  ON public.buyer_offer_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  );

CREATE POLICY "Privileged staff can insert buyer offer audit"
  ON public.buyer_offer_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'platform_owner')
      OR public.has_role(auth.uid(), 'founder')
    )
  );

CREATE INDEX idx_buyer_offer_audit_created_at ON public.buyer_offer_audit_log (created_at DESC);
