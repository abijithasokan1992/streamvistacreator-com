
-- Hide sensitive/internal admin note columns from non-admin readers by REVOKing
-- SELECT at the column level and re-granting only the safe columns to
-- authenticated. Admins keep writing via table-wide INSERT/UPDATE grants (RLS
-- gates who can actually do it); admin reads of the sensitive columns go
-- through SECURITY DEFINER RPCs below.

-- ============================================================================
-- 1) commercial_requests.admin_notes
-- ============================================================================
REVOKE ALL ON public.commercial_requests FROM anon;
REVOKE SELECT ON public.commercial_requests FROM authenticated;
GRANT SELECT (
  id, request_type, state, buyer_user_id, title_id, owner_user_id,
  message, terms, assigned_admin_id, accepted_agreement_id,
  state_changed_at, state_changed_by, created_at, updated_at,
  title_query, interest_summary, workspace_id
) ON public.commercial_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commercial_requests TO authenticated;
GRANT ALL ON public.commercial_requests TO service_role;

-- Admin-only read helper that returns the full row including admin_notes.
CREATE OR REPLACE FUNCTION public.admin_list_commercial_requests(_state text DEFAULT NULL)
RETURNS SETOF public.commercial_requests
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.commercial_requests r
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND (_state IS NULL OR _state = 'all' OR r.state::text = _state)
  ORDER BY r.created_at DESC
  LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.admin_list_commercial_requests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_commercial_requests(text) TO authenticated;

-- ============================================================================
-- 2) deal_memos.internal_notes
-- ============================================================================
REVOKE ALL ON public.deal_memos FROM anon;
REVOKE SELECT ON public.deal_memos FROM authenticated;
GRANT SELECT (
  id, memo_number, title_id, buyer_user_id, buyer_org_name, buyer_contact_email,
  commercial_request_id, deal_type, status, right_category, territory, language,
  exclusivity, term_start, term_end, amount_paise, currency, payment_terms,
  buyer_facing_memo, owner_admin_id, created_by, approved_at, closed_at,
  created_at, updated_at, ops_stage, approval_status, approval_notes, approved_by,
  rejected_by, rejected_at, rejection_reason, payment_status, payment_mode,
  paid_amount_paise, paid_at, payment_reference, payment_notes, delivery_status,
  delivered_at, delivery_notes, close_outcome, close_reason, closed_by,
  platform_share_paise, owner_share_paise, owner_share_pct
) ON public.deal_memos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.deal_memos TO authenticated;
GRANT ALL ON public.deal_memos TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_deal_memos(_title_id uuid DEFAULT NULL)
RETURNS SETOF public.deal_memos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.*
  FROM public.deal_memos d
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND (_title_id IS NULL OR d.title_id = _title_id)
  ORDER BY d.updated_at DESC
  LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.admin_list_deal_memos(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_deal_memos(uuid) TO authenticated;

-- ============================================================================
-- 3) title_commercial_profiles.{admin_internal_notes, chain_of_title_notes, legal_clearance_summary}
-- ============================================================================
REVOKE ALL ON public.title_commercial_profiles FROM anon;
REVOKE SELECT ON public.title_commercial_profiles FROM authenticated;
GRANT SELECT (
  id, title_id, owner_user_id, creator_tier, deal_mode, acquisition_open,
  licensing_open, distribution_open, screening_allowed, admin_approval_required,
  creator_final_approval_required, protection_tier, notes, created_at, updated_at,
  commercial_status, available_for_screeners, available_for_nonexclusive_license,
  available_for_exclusive_license, available_for_acquisition,
  available_for_distribution_partnership, rights_status_summary,
  delivery_readiness_summary, buyer_facing_summary, published_to_buyers
) ON public.title_commercial_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.title_commercial_profiles TO authenticated;
GRANT ALL ON public.title_commercial_profiles TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_title_commercial_profiles()
RETURNS SETOF public.title_commercial_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.title_commercial_profiles p
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
$$;
REVOKE ALL ON FUNCTION public.admin_list_title_commercial_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_title_commercial_profiles() TO authenticated;
