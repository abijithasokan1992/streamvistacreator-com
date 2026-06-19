
-- =========================================================================
-- Phase 1: Role-based platform foundation (purely additive)
-- =========================================================================

-- 1. Extend role enum -----------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_owner';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'studio';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buyer';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'localization_partner';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'distributor';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Status enums ---------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM
    ('draft','submitted','in_review','changes_requested','approved','locked','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.acquisition_status AS ENUM
    ('pending','accepted','declined','countered','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_assignment_status AS ENUM
    ('active','suspended','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. updated_at helper (idempotent reuse) --------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at_v2()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 4. Role helpers ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_signup_as(_role text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _role IN ('content_owner','studio','buyer')
$$;

CREATE OR REPLACE FUNCTION public.current_dashboard_role()
RETURNS public.app_role
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.app_role;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  -- New roles take precedence
  SELECT role INTO r FROM public.user_roles
   WHERE user_id = uid
     AND role IN ('super_admin','admin','content_owner','studio','buyer','localization_partner','distributor')
   ORDER BY CASE role
     WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2
     WHEN 'content_owner' THEN 3 WHEN 'studio' THEN 4
     WHEN 'distributor' THEN 5 WHEN 'localization_partner' THEN 6
     WHEN 'buyer' THEN 7 END LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  -- Legacy mapping
  SELECT CASE
    WHEN bool_or(role = 'admin') THEN 'admin'::public.app_role
    WHEN bool_or(role = 'executive_producer') THEN 'content_owner'::public.app_role
    WHEN bool_or(role = 'creator') THEN 'content_owner'::public.app_role
    WHEN bool_or(role = 'client') THEN 'buyer'::public.app_role
    ELSE NULL
  END INTO r FROM public.user_roles WHERE user_id = uid;
  RETURN r;
END $$;

-- 5. PLANS ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  role public.app_role NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  price_amount numeric(12,2) NOT NULL DEFAULT 0,
  gst_percent numeric(5,2) NOT NULL DEFAULT 18,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  storage_gb integer NOT NULL DEFAULT 0,
  bandwidth_gb integer NOT NULL DEFAULT 0,
  user_limit integer NOT NULL DEFAULT 1,
  trial_days integer NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'public', -- public | private | admin_only
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_read_visible" ON public.plans FOR SELECT TO authenticated
  USING (is_active AND NOT is_archived AND visibility IN ('public','private')
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "plans_admin_all" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 6. PLAN ASSIGNMENTS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.plan_assignment_status NOT NULL DEFAULT 'active',
  granted_by uuid,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_lifetime boolean NOT NULL DEFAULT false,
  is_promotional boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_user ON public.plan_assignments(user_id);
GRANT SELECT, INSERT, UPDATE ON public.plan_assignments TO authenticated;
GRANT ALL ON public.plan_assignments TO service_role;
ALTER TABLE public.plan_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_user_read_own" ON public.plan_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "pa_admin_all" ON public.plan_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_pa_updated BEFORE UPDATE ON public.plan_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 7. VOUCHERS -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  discount_percent numeric(5,2),
  discount_amount numeric(12,2),
  currency text DEFAULT 'INR',
  max_redemptions integer,
  redemptions_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'any', -- any | user | org
  target_user_id uuid,
  target_org_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vouchers_admin_all" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE POLICY "vouchers_targeted_read" ON public.vouchers FOR SELECT TO authenticated
  USING (is_active AND (scope = 'any' OR target_user_id = auth.uid()));
CREATE TRIGGER trg_vouchers_updated BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

CREATE TABLE IF NOT EXISTS public.voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  plan_assignment_id uuid REFERENCES public.plan_assignments(id) ON DELETE SET NULL,
  amount_off numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.voucher_redemptions TO authenticated;
GRANT ALL ON public.voucher_redemptions TO service_role;
ALTER TABLE public.voucher_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_owner_read" ON public.voucher_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "vr_admin_all" ON public.voucher_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- 8. STORAGE ALLOCATIONS --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  org_id uuid,
  allocated_gb integer NOT NULL DEFAULT 0,
  used_gb integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'admin_grant',
  granted_by uuid,
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storage_allocations TO authenticated;
GRANT ALL ON public.storage_allocations TO service_role;
ALTER TABLE public.storage_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_owner_read" ON public.storage_allocations FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "sa_admin_all" ON public.storage_allocations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_sa_updated BEFORE UPDATE ON public.storage_allocations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 9. PLATFORM SETTINGS (super admin) --------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ps_super_all" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "ps_admin_read" ON public.platform_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

-- 10. CONTENT TITLES + lifecycle -----------------------------------------
CREATE TABLE IF NOT EXISTS public.content_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  workspace_id uuid,
  title text NOT NULL,
  synopsis text,
  language text,
  genre text,
  duration_minutes integer,
  status public.content_status NOT NULL DEFAULT 'draft',
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  published_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_titles_owner ON public.content_titles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_content_titles_status ON public.content_titles(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_titles TO authenticated;
GRANT ALL ON public.content_titles TO service_role;
ALTER TABLE public.content_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_owner_rw" ON public.content_titles FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "ct_buyer_read_published" ON public.content_titles FOR SELECT TO authenticated
  USING (status = 'published');
CREATE TRIGGER trg_ct_updated BEFORE UPDATE ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- Lock guard: once locked, only owner/admin can mutate
CREATE OR REPLACE FUNCTION public.content_titles_lock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked = true
     AND NOT (public.has_role(auth.uid(),'admin'::public.app_role)
              OR public.is_super_admin(auth.uid())
              OR OLD.owner_user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Title is locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ct_lock_guard ON public.content_titles;
CREATE TRIGGER trg_ct_lock_guard BEFORE UPDATE OR DELETE ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.content_titles_lock_guard();

-- 11. CONTENT APPROVALS (audit log) --------------------------------------
CREATE TABLE IF NOT EXISTS public.content_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  from_status public.content_status,
  to_status public.content_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_approvals_title ON public.content_approvals(title_id);
GRANT SELECT, INSERT ON public.content_approvals TO authenticated;
GRANT ALL ON public.content_approvals TO service_role;
ALTER TABLE public.content_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_read_for_title_party" ON public.content_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t
                  WHERE t.id = title_id
                    AND (t.owner_user_id = auth.uid()
                         OR public.has_role(auth.uid(),'admin'::public.app_role)
                         OR public.is_super_admin(auth.uid()))));
CREATE POLICY "ca_insert_self" ON public.content_approvals FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());

-- 12. ACQUISITION REQUESTS (buyer → owner) -------------------------------
CREATE TABLE IF NOT EXISTS public.acquisition_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid NOT NULL,
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  status public.acquisition_status NOT NULL DEFAULT 'pending',
  territories text[] NOT NULL DEFAULT '{}',
  rights jsonb NOT NULL DEFAULT '{}'::jsonb,
  offer_amount numeric(14,2),
  offer_currency text DEFAULT 'INR',
  counter_amount numeric(14,2),
  counter_terms jsonb,
  message text,
  responded_at timestamptz,
  responded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acq_buyer ON public.acquisition_requests(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_acq_owner ON public.acquisition_requests(owner_user_id);
GRANT SELECT, INSERT, UPDATE ON public.acquisition_requests TO authenticated;
GRANT ALL ON public.acquisition_requests TO service_role;
ALTER TABLE public.acquisition_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acq_party_read" ON public.acquisition_requests FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR owner_user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "acq_buyer_insert" ON public.acquisition_requests FOR INSERT TO authenticated
  WITH CHECK (buyer_user_id = auth.uid());
CREATE POLICY "acq_party_update" ON public.acquisition_requests FOR UPDATE TO authenticated
  USING (buyer_user_id = auth.uid() OR owner_user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (buyer_user_id = auth.uid() OR owner_user_id = auth.uid()
         OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE TRIGGER trg_acq_updated BEFORE UPDATE ON public.acquisition_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();

-- 13. INVITATIONS (invite-only roles) ------------------------------------
CREATE TABLE IF NOT EXISTS public.role_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  invited_by uuid,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  accepted_user_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_inv_email ON public.role_invitations(lower(email));
GRANT SELECT, INSERT, UPDATE ON public.role_invitations TO authenticated;
GRANT ALL ON public.role_invitations TO service_role;
ALTER TABLE public.role_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ri_admin_all" ON public.role_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE POLICY "ri_invitee_read_own" ON public.role_invitations FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email','')));
CREATE TRIGGER trg_ri_updated BEFORE UPDATE ON public.role_invitations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_v2();
