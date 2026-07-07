
-- 1. Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='channel_partner' AND enumtypid='public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'channel_partner';
  END IF;
END $$;

DO $$ BEGIN
  CREATE TYPE public.org_kind AS ENUM ('creator','studio','buyer','channel_partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('draft','invited','onboarding','active','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS org_kind  public.org_kind   NOT NULL DEFAULT 'creator',
  ADD COLUMN IF NOT EXISTS status    public.org_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS published boolean           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz      NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS organizations_kind_status_idx
  ON public.organizations (org_kind, status, published);

-- 3. Link partner_profiles → organizations (1:1)
ALTER TABLE public.partner_profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partner_profiles_organization_id_uidx
  ON public.partner_profiles(organization_id)
  WHERE organization_id IS NOT NULL;

-- 4. Backfill: create an organization for every partner_profile that doesn't have one.
WITH created AS (
  INSERT INTO public.organizations (name, org_kind, status, published, logo_url, domain_name)
  SELECT p.name,
         'channel_partner'::public.org_kind,
         'active'::public.org_status,
         p.is_active,
         p.logo_url,
         p.website_url
    FROM public.partner_profiles p
   WHERE p.organization_id IS NULL
  RETURNING id, name, logo_url
)
UPDATE public.partner_profiles p
   SET organization_id = c.id
  FROM created c
 WHERE p.organization_id IS NULL
   AND c.name = p.name
   AND (c.logo_url IS NOT DISTINCT FROM p.logo_url);

-- 5. RLS refresh on partner_profiles: anon read requires published+active channel_partner org.
DROP POLICY IF EXISTS "Anyone can view active partner profiles" ON public.partner_profiles;

CREATE POLICY "Public reads published channel partners"
  ON public.partner_profiles FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.organizations o
       WHERE o.id = partner_profiles.organization_id
         AND o.org_kind = 'channel_partner'
         AND o.published = true
         AND o.status = 'active'
    )
  );

-- 6. Grants (idempotent)
GRANT SELECT ON public.partner_profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_profiles TO authenticated;
GRANT ALL ON public.partner_profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

-- 7. Security finding fixes
-- 7a. billing_manual_payment_submissions: buyers cannot pre-approve their own submissions.
DROP POLICY IF EXISTS bmps_owner_insert ON public.billing_manual_payment_submissions;
CREATE POLICY bmps_owner_insert
  ON public.billing_manual_payment_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitted_by_user_id = auth.uid()
    AND status = 'submitted'::public.billing_manual_status
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.billing_orders o
       WHERE o.id = billing_manual_payment_submissions.billing_order_id
         AND o.customer_user_id = auth.uid()
    )
  );

-- 7b. onboarding_requests: submitters cannot claim paid/approved status or an access code on insert.
DROP POLICY IF EXISTS onboarding_requests_anon_insert ON public.onboarding_requests;
CREATE POLICY onboarding_requests_anon_insert
  ON public.onboarding_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    submitter_user_id IS NULL
    AND onboarding_status = 'pending'
    AND payment_status    = 'pending'
    AND access_code IS NULL
  );

DROP POLICY IF EXISTS onboarding_requests_auth_insert ON public.onboarding_requests;
CREATE POLICY onboarding_requests_auth_insert
  ON public.onboarding_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitter_user_id = auth.uid()
    AND onboarding_status = 'pending'
    AND payment_status    = 'pending'
    AND access_code IS NULL
  );
