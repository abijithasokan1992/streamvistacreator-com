
-- ============================================================
-- Tighten edit access on Studio (and other org-scoped) profile
-- tax/billing fields to workspace owners/admins only.
-- Creator profiles (kind = 'creator') remain editable by their owner.
-- ============================================================

-- 1) Helper: can the current user manage the org-scoped profile?
--    Workspace owner/admin OR platform admin/super_admin.
CREATE OR REPLACE FUNCTION public.can_manage_org_entity_profile(_kind text, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _org_id IS NOT NULL
    AND _kind IN ('studio','buyer')
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
      OR public.is_workspace_admin(_org_id, auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_org_entity_profile(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_org_entity_profile(text, uuid) TO authenticated, service_role;

-- 2) Trigger: block sensitive-field changes on entity_profiles for studio/buyer
--    rows unless the caller is a workspace owner/admin (or platform admin).
CREATE OR REPLACE FUNCTION public.guard_entity_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_changed boolean := false;
BEGIN
  -- Service role bypass (edge functions / admin scripts).
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Only guard org-scoped studio/buyer profiles. Creator profiles are
  -- already locked down by the existing row-level policy.
  IF NEW.kind NOT IN ('studio','buyer') OR NEW.org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Detect any change to sensitive identity / tax / billing / address fields.
  v_changed :=
       NEW.legal_name              IS DISTINCT FROM OLD.legal_name
    OR NEW.entity_type             IS DISTINCT FROM OLD.entity_type
    OR NEW.pan_number              IS DISTINCT FROM OLD.pan_number
    OR NEW.gstin                   IS DISTINCT FROM OLD.gstin
    OR NEW.tan_number              IS DISTINCT FROM OLD.tan_number
    OR NEW.cin_number              IS DISTINCT FROM OLD.cin_number
    OR NEW.is_gst_registered       IS DISTINCT FROM OLD.is_gst_registered
    OR NEW.place_of_supply_state   IS DISTINCT FROM OLD.place_of_supply_state
    OR NEW.billing_legal_name      IS DISTINCT FROM OLD.billing_legal_name
    OR NEW.billing_email           IS DISTINCT FROM OLD.billing_email
    OR NEW.billing_phone           IS DISTINCT FROM OLD.billing_phone
    OR NEW.billing_address_line1   IS DISTINCT FROM OLD.billing_address_line1
    OR NEW.billing_address_line2   IS DISTINCT FROM OLD.billing_address_line2
    OR NEW.billing_city            IS DISTINCT FROM OLD.billing_city
    OR NEW.billing_state           IS DISTINCT FROM OLD.billing_state
    OR NEW.billing_postal_code     IS DISTINCT FROM OLD.billing_postal_code
    OR NEW.billing_country         IS DISTINCT FROM OLD.billing_country
    OR NEW.billing_notes           IS DISTINCT FROM OLD.billing_notes
    OR NEW.address_line1           IS DISTINCT FROM OLD.address_line1
    OR NEW.address_line2           IS DISTINCT FROM OLD.address_line2
    OR NEW.city                    IS DISTINCT FROM OLD.city
    OR NEW.state                   IS DISTINCT FROM OLD.state
    OR NEW.postal_code             IS DISTINCT FROM OLD.postal_code
    OR NEW.country                 IS DISTINCT FROM OLD.country
    OR NEW.primary_email           IS DISTINCT FROM OLD.primary_email
    OR NEW.primary_phone           IS DISTINCT FROM OLD.primary_phone
    OR NEW.whatsapp                IS DISTINCT FROM OLD.whatsapp;

  IF v_changed AND NOT public.can_manage_org_entity_profile(NEW.kind, NEW.org_id) THEN
    RAISE EXCEPTION
      'Only workspace owners or admins can change studio tax, billing or identity fields.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_entity_profile_sensitive ON public.entity_profiles;
CREATE TRIGGER trg_guard_entity_profile_sensitive
BEFORE UPDATE ON public.entity_profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_entity_profile_sensitive_fields();

-- 3) Replace existing UPDATE policy on entity_profiles with a stricter version
--    that requires an authenticated caller AND re-validates on the new row.
DROP POLICY IF EXISTS "update entity profile" ON public.entity_profiles;
CREATE POLICY "update entity profile"
ON public.entity_profiles
FOR UPDATE
TO authenticated
USING (
  -- Existing read/edit gate (admin OR creator-self OR workspace admin).
  public.can_edit_entity_profile(kind, user_id, org_id)
)
WITH CHECK (
  public.can_edit_entity_profile(kind, user_id, org_id)
  -- For org-scoped studio/buyer rows the caller must be a workspace admin
  -- (or platform admin). Creator rows are unaffected.
  AND (
    kind = 'creator'
    OR public.can_manage_org_entity_profile(kind, org_id)
  )
);

-- 4) Tighten studio extension table: only workspace owners/admins (or platform
--    admins) may insert/update/delete. Members can still read via the
--    existing "view studio ext" policy.
DROP POLICY IF EXISTS "manage studio ext" ON public.entity_profile_studio_ext;

CREATE POLICY "insert studio ext"
ON public.entity_profile_studio_ext
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.entity_profiles p
    WHERE p.id = profile_id
      AND public.can_manage_org_entity_profile(p.kind, p.org_id)
  )
);

CREATE POLICY "update studio ext"
ON public.entity_profile_studio_ext
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.entity_profiles p
    WHERE p.id = profile_id
      AND public.can_manage_org_entity_profile(p.kind, p.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.entity_profiles p
    WHERE p.id = profile_id
      AND public.can_manage_org_entity_profile(p.kind, p.org_id)
  )
);

CREATE POLICY "delete studio ext"
ON public.entity_profile_studio_ext
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.entity_profiles p
    WHERE p.id = profile_id
      AND public.can_manage_org_entity_profile(p.kind, p.org_id)
  )
);
