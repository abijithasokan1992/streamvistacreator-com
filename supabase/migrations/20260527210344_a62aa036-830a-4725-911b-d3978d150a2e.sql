CREATE TABLE public.onboarding_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id UUID NOT NULL REFERENCES public.onboarding_requests(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  event TEXT NOT NULL,
  message_sid TEXT UNIQUE,
  to_number TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_notifications_request ON public.onboarding_notifications(onboarding_request_id);
CREATE INDEX idx_onboarding_notifications_sid ON public.onboarding_notifications(message_sid);

GRANT SELECT ON public.onboarding_notifications TO authenticated;
GRANT ALL ON public.onboarding_notifications TO service_role;

ALTER TABLE public.onboarding_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view notifications" ON public.onboarding_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));