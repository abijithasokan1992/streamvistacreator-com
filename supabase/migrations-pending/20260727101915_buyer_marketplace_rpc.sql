-- =====================================================================
-- Batch 1 (PENDING — NOT auto-applied): Buyer marketplace RPC
-- ---------------------------------------------------------------------
-- Location: supabase/migrations-pending/ per repo policy (see
-- supabase/migrations-pending/README.md). This file will NOT be picked
-- up by the Supabase migration runner. Promote by moving into
-- supabase/migrations/ only after explicit approval.
--
-- Reuse-first: no new tables. Gates on entity_profiles.verification_status
-- and legal_acceptances (buyer_request_confidentiality). Fail-closed.
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
    NULL::text AS poster_url,
    ct.updated_at
  FROM public.content_titles ct
  JOIN public.title_commercial_profiles tcp ON tcp.title_id = ct.id
  WHERE
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
        AND ep.verification_status = 'verified'
        AND (o.id IS NULL OR o.status <> 'suspended'::org_status)
    )
    AND EXISTS (
      SELECT 1 FROM public.legal_acceptances la
      WHERE la.user_id = auth.uid()
        AND la.agreement_type = 'buyer_request_confidentiality'::legal_agreement_type
    )
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
