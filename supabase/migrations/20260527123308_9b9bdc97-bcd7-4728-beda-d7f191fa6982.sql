
-- 1. Audit log table
CREATE TABLE public.onboarding_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_request_id UUID NOT NULL,
  changed_by UUID,
  changed_by_email TEXT,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_request ON public.onboarding_audit_log(onboarding_request_id);
CREATE INDEX idx_audit_created ON public.onboarding_audit_log(created_at DESC);

GRANT SELECT ON public.onboarding_audit_log TO authenticated;
GRANT ALL ON public.onboarding_audit_log TO service_role;

ALTER TABLE public.onboarding_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON public.onboarding_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Audit trigger
CREATE OR REPLACE FUNCTION public.log_onboarding_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email TEXT;
BEGIN
  SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();

  IF NEW.onboarding_status IS DISTINCT FROM OLD.onboarding_status THEN
    INSERT INTO public.onboarding_audit_log(onboarding_request_id, changed_by, changed_by_email, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), actor_email, 'onboarding_status', OLD.onboarding_status, NEW.onboarding_status);
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.onboarding_audit_log(onboarding_request_id, changed_by, changed_by_email, field_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), actor_email, 'payment_status', OLD.payment_status, NEW.payment_status);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_onboarding_audit
  AFTER UPDATE ON public.onboarding_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_status_changes();

-- 3. DMCA requests table
CREATE TABLE public.dmca_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_name TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  reporter_address TEXT,
  reporter_phone TEXT,
  copyright_work TEXT NOT NULL,
  infringing_url TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_path TEXT,
  good_faith_statement BOOLEAN NOT NULL DEFAULT false,
  accuracy_statement BOOLEAN NOT NULL DEFAULT false,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.dmca_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.dmca_requests TO authenticated;
GRANT ALL ON public.dmca_requests TO service_role;

ALTER TABLE public.dmca_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit DMCA"
  ON public.dmca_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(reporter_name)) BETWEEN 1 AND 200
    AND reporter_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(trim(copyright_work)) BETWEEN 1 AND 2000
    AND length(trim(infringing_url)) BETWEEN 5 AND 1000
    AND length(trim(description)) BETWEEN 1 AND 5000
    AND length(trim(signature)) BETWEEN 1 AND 200
    AND good_faith_statement = true
    AND accuracy_statement = true
    AND status = 'pending'
  );

CREATE POLICY "Admins view DMCA"
  ON public.dmca_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update DMCA"
  ON public.dmca_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Storage bucket for evidence (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('dmca-evidence', 'dmca-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can upload DMCA evidence"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'dmca-evidence');

CREATE POLICY "Admins read DMCA evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dmca-evidence' AND public.has_role(auth.uid(), 'admin'));
