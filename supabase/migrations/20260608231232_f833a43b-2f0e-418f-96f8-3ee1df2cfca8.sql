
-- 1. Extend the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executive_producer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'creator';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

COMMIT;

-- 2. Default-role trigger: every new auth user gets the 'client' role
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_assign_default_role ON auth.users;
CREATE TRIGGER on_auth_user_assign_default_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_default_role();

-- 3. Highest-role helper (admin > executive_producer > creator > client)
CREATE OR REPLACE FUNCTION public.primary_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'executive_producer' THEN 2
    WHEN 'creator' THEN 3
    WHEN 'moderator' THEN 4
    WHEN 'client' THEN 5
    WHEN 'user' THEN 6
  END
  LIMIT 1
$$;

-- 4. producer_assignments table (EP ↔ Creator mapping; admin-managed)
CREATE TABLE IF NOT EXISTS public.producer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ep_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ep_user_id, creator_user_id)
);

GRANT SELECT ON public.producer_assignments TO authenticated;
GRANT ALL ON public.producer_assignments TO service_role;

ALTER TABLE public.producer_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "EPs and Creators see own row"
  ON public.producer_assignments FOR SELECT TO authenticated
  USING (
    auth.uid() = ep_user_id
    OR auth.uid() = creator_user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins insert assignments"
  ON public.producer_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update assignments"
  ON public.producer_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete assignments"
  ON public.producer_assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. is_producer_of helper
CREATE OR REPLACE FUNCTION public.is_producer_of(_ep uuid, _creator uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.producer_assignments
    WHERE ep_user_id = _ep AND creator_user_id = _creator
  )
$$;

-- 6. Extend shared_files SELECT so EPs see their Creators' files (read-only).
-- Owners' own SELECT policy and admin SELECT policy stay as-is.
DROP POLICY IF EXISTS "EPs view assigned creators files" ON public.shared_files;
CREATE POLICY "EPs view assigned creators files"
  ON public.shared_files FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'executive_producer')
    AND public.is_producer_of(auth.uid(), owner_id)
  );
