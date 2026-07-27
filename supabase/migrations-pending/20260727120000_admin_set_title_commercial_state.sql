-- =====================================================================
-- Batch 2 (PENDING — NOT auto-applied): admin_set_title_commercial_state
-- ---------------------------------------------------------------------
-- Location: supabase/migrations-pending/ per repo policy (see
-- supabase/migrations-pending/README.md). This file will NOT be picked
-- up by the Supabase migration runner. Promote by moving into
-- supabase/migrations/ only after explicit approval.
--
-- Reuse-first evidence:
--   * Table  public.title_commercial_profiles         (migration 20260622131854)
--   * Enum   public.title_commercial_status           (migration 20260622172253)
--   * Audit  public.commercial_audit_log              (migration 20260622171236)
--   * Guard  public.has_role(uuid, app_role)          (existing helper)
--   * Notes  public.admin_tcp_set_internal_notes()    (migration 20260713132854)
--
-- No new tables. No new buckets. No new edge functions. RLS unchanged.
-- Enforces:
--   * admin caller only,
--   * non-empty audit reason (>= 4 chars trimmed),
--   * enum-safe status transition,
--   * ownership row exists (upserts profile skeleton if missing, reusing
--     the same defaults as the auto-provision trigger in 20260622131854),
--   * writes one row to commercial_audit_log with prev/new state + reason.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_set_title_commercial_state(
  _title_id             uuid,
  _new_status           public.title_commercial_status,
  _published_to_buyers  boolean,
  _reason               text
)
RETURNS public.title_commercial_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason text := btrim(coalesce(_reason, ''));
  v_owner  uuid;
  v_prev   public.title_commercial_profiles;
  v_next   public.title_commercial_profiles;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _title_id IS NULL THEN
    RAISE EXCEPTION 'title_id required' USING ERRCODE = '22023';
  END IF;

  IF _new_status IS NULL THEN
    RAISE EXCEPTION 'commercial_status required' USING ERRCODE = '22023';
  END IF;

  IF length(v_reason) < 4 THEN
    RAISE EXCEPTION 'audit reason required (min 4 chars)' USING ERRCODE = '22023';
  END IF;

  SELECT owner_user_id INTO v_owner
    FROM public.content_titles WHERE id = _title_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'title not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_prev
    FROM public.title_commercial_profiles WHERE title_id = _title_id;

  INSERT INTO public.title_commercial_profiles (title_id, owner_user_id,
                                                commercial_status, published_to_buyers)
  VALUES (_title_id, v_owner, _new_status, coalesce(_published_to_buyers, false))
  ON CONFLICT (title_id) DO UPDATE
     SET commercial_status    = EXCLUDED.commercial_status,
         published_to_buyers  = EXCLUDED.published_to_buyers,
         updated_at           = now()
  RETURNING * INTO v_next;

  INSERT INTO public.commercial_audit_log
    (actor_id, action, subject_user_id, details)
  VALUES (
    auth.uid(),
    'title_commercial_state.set',
    v_owner,
    jsonb_build_object(
      'title_id',                   _title_id,
      'previous_commercial_status', coalesce(v_prev.commercial_status::text, null),
      'new_commercial_status',      v_next.commercial_status::text,
      'previous_published_to_buyers', coalesce(v_prev.published_to_buyers, false),
      'new_published_to_buyers',    v_next.published_to_buyers,
      'reason',                     v_reason
    )
  );

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_title_commercial_state(
  uuid, public.title_commercial_status, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_title_commercial_state(
  uuid, public.title_commercial_status, boolean, text
) TO authenticated;
