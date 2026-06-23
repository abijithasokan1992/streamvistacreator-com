
CREATE TABLE public.hard_disk_intakes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_title text,
  drive_label text NOT NULL,
  drive_serial text,
  drive_capacity_gb integer,
  estimated_content_gb integer,
  drive_interface text,
  filesystem text,
  handoff_method text NOT NULL DEFAULT 'courier',
  courier_tracking text,
  expected_arrival date,
  contact_name text,
  contact_phone text,
  pickup_address text,
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hard_disk_intakes TO authenticated;
GRANT ALL ON public.hard_disk_intakes TO service_role;

ALTER TABLE public.hard_disk_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studios can insert their own hard disk intakes"
  ON public.hard_disk_intakes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Studios can view their own hard disk intakes"
  ON public.hard_disk_intakes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Studios can update their own pending hard disk intakes"
  ON public.hard_disk_intakes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'submitted')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage hard disk intakes"
  ON public.hard_disk_intakes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_hard_disk_intakes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_hard_disk_intakes_updated_at
  BEFORE UPDATE ON public.hard_disk_intakes
  FOR EACH ROW EXECUTE FUNCTION public.tg_hard_disk_intakes_set_updated_at();

CREATE INDEX idx_hard_disk_intakes_user ON public.hard_disk_intakes(user_id, created_at DESC);
CREATE INDEX idx_hard_disk_intakes_status ON public.hard_disk_intakes(status, created_at DESC);
