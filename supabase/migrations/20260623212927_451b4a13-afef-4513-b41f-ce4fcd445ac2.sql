
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.internal_department AS ENUM (
    'finance','billing','audit','management','operations','legal','qc','engineering'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.internal_designation AS ENUM (
    'auditor','accounts_staff','billing_staff','finance_approver',
    'finance_head','ca_finance_reviewer','management_reviewer',
    'ops_lead','engineering'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.internal_permission AS ENUM (
    'finance_read','finance_admin','billing_ops','invoice_approval',
    'refund_approval','manual_invoice_write','subscription_read',
    'audit_readonly','finance_reports','management_reports',
    'review_ops','buyer_request_ops','storage_adjustment_ops'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.internal_staff_status AS ENUM ('invited','active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. admin_staff_profiles
CREATE TABLE IF NOT EXISTS public.admin_staff_profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    text NOT NULL,
  email        text NOT NULL,
  department   public.internal_department NOT NULL,
  designation  public.internal_designation NOT NULL,
  status       public.internal_staff_status NOT NULL DEFAULT 'invited',
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff_profiles TO authenticated;
GRANT ALL ON public.admin_staff_profiles TO service_role;

ALTER TABLE public.admin_staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage admin_staff_profiles"
  ON public.admin_staff_profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Staff can read own admin profile"
  ON public.admin_staff_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. admin_staff_permissions
CREATE TABLE IF NOT EXISTS public.admin_staff_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.admin_staff_profiles(user_id) ON DELETE CASCADE,
  permission  public.internal_permission NOT NULL,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, permission)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_staff_permissions TO authenticated;
GRANT ALL ON public.admin_staff_permissions TO service_role;

ALTER TABLE public.admin_staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage admin_staff_permissions"
  ON public.admin_staff_permissions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Staff can read own permissions"
  ON public.admin_staff_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_admin_staff_profiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_staff_profiles_set_updated_at ON public.admin_staff_profiles;
CREATE TRIGGER admin_staff_profiles_set_updated_at
  BEFORE UPDATE ON public.admin_staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_admin_staff_profiles_set_updated_at();

-- 5. Helper: has_admin_permission
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _perm public.internal_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- super_admin implicitly has every internal permission
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.admin_staff_permissions p
      JOIN public.admin_staff_profiles s ON s.user_id = p.user_id
      WHERE p.user_id = _user_id
        AND p.permission = _perm
        AND s.status = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.has_admin_permission(uuid, public.internal_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, public.internal_permission)
  TO authenticated, service_role;

-- 6. Helpful indexes
CREATE INDEX IF NOT EXISTS admin_staff_profiles_dept_idx     ON public.admin_staff_profiles(department);
CREATE INDEX IF NOT EXISTS admin_staff_profiles_status_idx   ON public.admin_staff_profiles(status);
CREATE INDEX IF NOT EXISTS admin_staff_permissions_perm_idx  ON public.admin_staff_permissions(permission);
