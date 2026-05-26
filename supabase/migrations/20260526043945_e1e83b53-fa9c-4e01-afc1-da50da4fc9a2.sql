-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- user_roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap: lets the first authenticated user become admin if none exists yet
CREATE OR REPLACE FUNCTION public.claim_admin_if_none()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  admin_count INT;
BEGIN
  IF uid IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count > 0 THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

-- Extend onboarding_requests
ALTER TABLE public.onboarding_requests
  ADD COLUMN business_email TEXT,
  ALTER COLUMN contact_phone DROP NOT NULL;

-- Replace insert policy to allow optional phone and require either phone or email
DROP POLICY IF EXISTS "Public can submit valid onboarding request" ON public.onboarding_requests;

CREATE POLICY "Public can submit valid onboarding request"
  ON public.onboarding_requests FOR INSERT TO anon, authenticated
  WITH CHECK (
    length(trim(client_name)) BETWEEN 1 AND 200
    AND length(trim(professional_role)) BETWEEN 1 AND 100
    AND (
      (contact_phone IS NOT NULL AND length(trim(contact_phone)) BETWEEN 6 AND 30)
      OR (business_email IS NOT NULL AND business_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    )
    AND selected_cycle = ANY (ARRAY['monthly','quarterly','yearly'])
    AND base_price >= 0
    AND final_price >= 0
    AND onboarding_status = 'pending'
  );

-- Admin read/update on onboarding_requests
CREATE POLICY "Admins can view onboarding requests"
  ON public.onboarding_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update onboarding requests"
  ON public.onboarding_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));