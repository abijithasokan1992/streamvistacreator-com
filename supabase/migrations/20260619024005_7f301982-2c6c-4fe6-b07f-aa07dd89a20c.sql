
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 255),
  company text CHECK (company IS NULL OR length(company) <= 160),
  role text CHECK (role IS NULL OR length(role) <= 80),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied','archived')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_agent text,
  source text DEFAULT 'public_contact_form',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. guests) can submit a contact message.
CREATE POLICY "Public can submit contact messages"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read.
CREATE POLICY "Admins can read contact messages"
  ON public.contact_messages FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));

-- Only admins can update (mark read/replied/archived).
CREATE POLICY "Admins can update contact messages"
  ON public.contact_messages FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
              OR public.is_super_admin(auth.uid()));

-- Only super admins can delete.
CREATE POLICY "Super admins can delete contact messages"
  ON public.contact_messages FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER contact_messages_touch_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX contact_messages_created_at_idx ON public.contact_messages (created_at DESC);
CREATE INDEX contact_messages_status_idx ON public.contact_messages (status, created_at DESC);
