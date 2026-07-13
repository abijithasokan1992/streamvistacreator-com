
-- Return commercial requests joined with admin_notes for admins
DROP FUNCTION IF EXISTS public.admin_list_commercial_requests(text);

CREATE OR REPLACE FUNCTION public.admin_list_commercial_requests(_state text DEFAULT NULL::text)
RETURNS TABLE (
  id uuid,
  request_type text,
  state commercial_request_state,
  buyer_user_id uuid,
  title_id uuid,
  owner_user_id uuid,
  message text,
  terms jsonb,
  admin_notes text,
  assigned_admin_id uuid,
  accepted_agreement_id uuid,
  state_changed_at timestamptz,
  state_changed_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  title_query text,
  interest_summary text,
  workspace_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.id, r.request_type::text, r.state, r.buyer_user_id, r.title_id, r.owner_user_id,
    r.message, r.terms, a.admin_notes, a.assigned_admin_id, r.accepted_agreement_id,
    r.state_changed_at, r.state_changed_by, r.created_at, r.updated_at,
    r.title_query, r.interest_summary, r.workspace_id
  FROM public.commercial_requests r
  LEFT JOIN public.commercial_requests_admin a ON a.request_id = r.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND (_state IS NULL OR _state = 'all' OR r.state::text = _state)
  ORDER BY r.created_at DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_commercial_requests(text) TO authenticated;
