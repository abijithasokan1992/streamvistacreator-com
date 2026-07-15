
-- 1. content_titles: remove overly permissive "Allow creator inserts" policy
DROP POLICY IF EXISTS "Allow creator inserts" ON public.content_titles;
-- ct_insert_owner_or_admin remains and enforces owner_user_id=auth.uid()+draft state.

-- 2. distribution_partners: replace unbounded read with active-only, and hide sensitive columns
DROP POLICY IF EXISTS "Allow authenticated read partners" ON public.distribution_partners;

CREATE POLICY "Authenticated read active partners"
  ON public.distribution_partners
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Column-level restriction: sensitive operational fields limited to admin/service_role
REVOKE SELECT ON public.distribution_partners FROM authenticated;
GRANT SELECT (id, slug, name, protocol, description, is_active, requires_aspera, requires_signiant,
              default_package_type, supported_package_types, delivery_window, logo_url,
              created_at, updated_at)
  ON public.distribution_partners TO authenticated;
-- contact_email + config remain readable only to service_role/admin.

-- 3. onboarding_requests: seal promo-code pricing gap
DROP POLICY IF EXISTS onboarding_requests_anon_insert ON public.onboarding_requests;
DROP POLICY IF EXISTS onboarding_requests_auth_insert ON public.onboarding_requests;

CREATE POLICY onboarding_requests_anon_insert
  ON public.onboarding_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    submitter_user_id IS NULL
    AND onboarding_status = 'pending'
    AND payment_status = ANY (ARRAY['pending','free'])
    AND access_code IS NULL
    AND lower(COALESCE(selected_cycle,'')) = ANY (ARRAY['free','creator','topup'])
    AND base_price = (CASE lower(selected_cycle)
                        WHEN 'free' THEN 0
                        WHEN 'creator' THEN 650
                        WHEN 'topup' THEN 650
                        ELSE NULL END)::numeric
    AND (
      (promo_code IS NULL AND final_price = base_price)
      OR (promo_code = 'INDUSTRY100' AND final_price = 0 AND payment_status = 'free')
    )
  );

CREATE POLICY onboarding_requests_auth_insert
  ON public.onboarding_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    submitter_user_id = auth.uid()
    AND onboarding_status = 'pending'
    AND payment_status = ANY (ARRAY['pending','free'])
    AND access_code IS NULL
    AND lower(COALESCE(selected_cycle,'')) = ANY (ARRAY['free','creator','topup'])
    AND base_price = (CASE lower(selected_cycle)
                        WHEN 'free' THEN 0
                        WHEN 'creator' THEN 650
                        WHEN 'topup' THEN 650
                        ELSE NULL END)::numeric
    AND (
      (promo_code IS NULL AND final_price = base_price)
      OR (promo_code = 'INDUSTRY100' AND final_price = 0 AND payment_status = 'free')
    )
  );

-- 4. Realtime scope: ensure UPDATE/DELETE payloads carry the scoping columns so RLS filters
--    correctly on the wire (postgres_changes evaluates RLS against payload rows).
ALTER TABLE public.agent_events REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.recent_uploads REPLICA IDENTITY FULL;
ALTER TABLE public.storage_topups REPLICA IDENTITY FULL;
ALTER TABLE public.title_removal_requests REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_storage_entitlements REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_storage_usage REPLICA IDENTITY FULL;
