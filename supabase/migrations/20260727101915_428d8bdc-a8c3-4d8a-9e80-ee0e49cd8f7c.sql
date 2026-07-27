
-- =====================================================================
-- Batch 1: Buyer marketplace RPC (reuse-first — no new tables)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.buyer_list_marketplace_titles()
RETURNS TABLE (
  id uuid,
  title text,
  synopsis text,
  language text,
  genre text,
  duration_minutes integer,
  kind title_kind,
  metadata_year integer,
  commercial_status title_commercial_status,
  screener_available boolean,
  licensing_nonexclusive_available boolean,
  licensing_exclusive_available boolean,
  acquisition_available boolean,
  distribution_partnership_available boolean,
  buyer_facing_summary text,
  poster_url text,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Fail-closed caller gate: authenticated buyer, not suspended,
  -- verified entity_profile (kind='buyer', verification_status='verified'),
  -- org (if any) not suspended, and accepted buyer_request_confidentiality NDA.
  -- Any missing condition yields an empty result — no error, no enumeration.
  SELECT
    ct.id,
    ct.title,
    ct.synopsis,
    ct.language,
    ct.genre,
    ct.duration_minutes,
    ct.kind,
    NULLIF(regexp_replace(coalesce(ct.metadata->>'year', ct.metadata->>'release_year',''), '\D', '', 'g'), '')::int AS metadata_year,
    tcp.commercial_status,
    tcp.available_for_screeners AS screener_available,
    tcp.available_for_nonexclusive_license AS licensing_nonexclusive_available,
    tcp.available_for_exclusive_license AS licensing_exclusive_available,
    tcp.available_for_acquisition AS acquisition_available,
    tcp.available_for_distribution_partnership AS distribution_partnership_available,
    tcp.buyer_facing_summary,
    NULL::text AS poster_url, -- Batch 1: no buyer-safe signed URL surface yet
    ct.updated_at
  FROM public.content_titles ct
  JOIN public.title_commercial_profiles tcp ON tcp.title_id = ct.id
  WHERE
    -- Caller gate
    auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'buyer')
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.is_suspended = false
    )
    AND EXISTS (
      SELECT 1 FROM public.entity_profiles ep
      LEFT JOIN public.organizations o ON o.id = ep.org_id
      WHERE ep.user_id = auth.uid()
        AND ep.kind = 'buyer'
        AND ep.verification_status = 'verified' -- source of truth: entity_profiles.verification_status
        AND (o.id IS NULL OR o.status <> 'suspended'::org_status)
    )
    AND EXISTS (
      SELECT 1 FROM public.legal_acceptances la
      WHERE la.user_id = auth.uid()
        AND la.agreement_type = 'buyer_request_confidentiality'::legal_agreement_type
    )
    -- Eligibility filter
    AND ct.status = 'ready_for_distribution'::content_status
    AND tcp.published_to_buyers = true
    AND tcp.commercial_status IN (
      'screening_only'::title_commercial_status,
      'licensing_open'::title_commercial_status,
      'acquisition_open'::title_commercial_status,
      'invite_only'::title_commercial_status
    )
    AND (
      tcp.available_for_screeners
      OR tcp.available_for_nonexclusive_license
      OR tcp.available_for_exclusive_license
      OR tcp.available_for_acquisition
      OR tcp.available_for_distribution_partnership
    )
  ORDER BY ct.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.buyer_list_marketplace_titles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_list_marketplace_titles() TO authenticated;

-- =====================================================================
-- Security fix: user_profiles privileged-field guard
-- Users may still edit non-privileged profile fields, but plan_tier,
-- storage/bandwidth quotas, topup_tb, purchased_title_slots,
-- is_suspended, idle_status, idle_flagged_at, idle_frozen_at,
-- studio_slug, access_authorization_code, storage_used_mb,
-- bandwidth_used_mb are force-reverted for non-admin, non-service-role
-- callers. Admins and service_role can update freely.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.guard_user_profiles_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean := false;
BEGIN
  -- service_role bypass (webhooks, admin functions running with service key)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    is_privileged := true;
  END IF;

  IF NOT is_privileged THEN
    NEW.plan_tier                    := OLD.plan_tier;
    NEW.storage_used_mb              := OLD.storage_used_mb;
    NEW.bandwidth_used_mb            := OLD.bandwidth_used_mb;
    NEW.bandwidth_quota_gb           := OLD.bandwidth_quota_gb;
    NEW.bandwidth_overage_inr_per_gb := OLD.bandwidth_overage_inr_per_gb;
    NEW.topup_tb                     := OLD.topup_tb;
    NEW.purchased_title_slots        := OLD.purchased_title_slots;
    NEW.is_suspended                 := OLD.is_suspended;
    NEW.idle_status                  := OLD.idle_status;
    NEW.idle_flagged_at              := OLD.idle_flagged_at;
    NEW.idle_frozen_at               := OLD.idle_frozen_at;
    NEW.studio_slug                  := OLD.studio_slug;
    NEW.access_authorization_code    := OLD.access_authorization_code;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_profiles_privileged_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_user_profiles_privileged_fields ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profiles_privileged_fields
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profiles_privileged_fields();
