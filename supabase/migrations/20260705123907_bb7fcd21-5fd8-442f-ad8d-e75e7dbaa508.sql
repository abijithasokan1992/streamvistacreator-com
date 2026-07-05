
CREATE TABLE public.intelligence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'manual',
  total_signals INT NOT NULL DEFAULT 0,
  lanes_count INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_by UUID
);

CREATE INDEX intelligence_snapshots_created_at_idx ON public.intelligence_snapshots (created_at DESC);

GRANT SELECT, INSERT ON public.intelligence_snapshots TO authenticated;
GRANT ALL ON public.intelligence_snapshots TO service_role;

ALTER TABLE public.intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view intelligence snapshots"
ON public.intelligence_snapshots
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert intelligence snapshots"
ON public.intelligence_snapshots
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
