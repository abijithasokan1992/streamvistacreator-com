-- =====================================================================
-- Batch 2 (PENDING — NOT auto-applied): admin_set_title_commercial_state
-- ---------------------------------------------------------------------
-- Location: supabase/migrations-pending/ per repo policy (see
-- supabase/migrations-pending/README.md). This file will NOT be picked
-- up by the Supabase migration runner. Promote by moving into
-- supabase/migrations/ only after explicit approval.
--
-- Reuse-first evidence (verified in repo):
--   * Table  public.title_commercial_profiles          (migration 20260622131854)
--   * Enum   public.title_commercial_status            (migration 20260622172253)
--   * Cols   available_for_screeners,
--            available_for_nonexclusive_license,
--            available_for_exclusive_license,
--            available_for_acquisition,
--            available_for_distribution_partnership    (migration 20260622172253)
--   * Enum   public.content_status ('ready_for_distribution')
--   * Audit  public.commercial_audit_log               (migration 20260622171236)
--   * Guard  public.has_role(uuid, app_role)           (existing helper)
--
-- No new tables. No new buckets. No new edge functions. RLS unchanged.
--
-- Batch 2 gap-closure — Server-side enforcement:
--   1. admin/super_admin only
--   2. non-empty audit reason (>= 4 chars trimmed)
--   3. PUBLISHING (published_to_buyers = TRUE) requires ALL of:
--        a. content_titles.status = 'ready_for_distribution'
--        b. new commercial_status is marketplace-eligible
--           (screening_only | licensing_open | acquisition_open | invite_only)
--        c. at least one of the five availability flags is TRUE
--   4. UNPUBLISHING (published_to_buyers = FALSE) is always allowed to
--      admins — RFD/eligibility gates are skipped so a bad title can be
--      pulled from buyer visibility immediately.
--   5. Commercial status, published flag, and all five availability flags
--      are updated atomically in one row.
--   6. Exactly one commercial_audit_log row captures prev + new snapshot
--      of status, published flag, and every availability flag + reason.
-- =====================================================================

-- Drop prior overloaded signature (from earlier Batch 2 attempt).
DROP FUNCTION IF EXISTS public.admin_set_title_commercial_state(
  uuid, public.title_commercial_status, boolean, text
);

CREATE OR REPLACE FUNCTION public.admin_set_title_commercial_state(
  _title_id                                uuid,
  _new_status                              public.title_commercial_status,
  _published_to_buyers                     boolean,
  _available_for_screeners                 boolean,
  _available_for_nonexclusive_license      boolean,
  _available_for_exclusive_license         boolean,
  _available_for_acquisition               boolean,
  _available_for_distribution_partnership  boolean,
  _reason                                  text
)
RETURNS public.title_commercial_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason        text := btrim(coalesce(_reason, ''));
  v_owner         uuid;
  v_title_status  public.content_status;
  v_prev          public.title_commercial_profiles;
  v_next          public.title_commercial_profiles;
  v_pub           boolean := coalesce(_published_to_buyers, false);
  v_scr           boolean := coalesce(_available_for_screeners, false);
  v_nex           boolean := coalesce(_available_for_nonexclusive_license, false);
  v_exc           boolean := coalesce(_available_for_exclusive_license, false);
  v_acq           boolean := coalesce(_available_for_acquisition, false);
  v_dist          boolean := coalesce(_available_for_distribution_partnership, false);
  v_any_flag      boolean;
BEGIN
  -- 1. authz
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

  -- 2. title must exist; capture owner + workflow status
  SELECT owner_user_id, status
    INTO v_owner, v_title_status
    FROM public.content_titles
   WHERE id = _title_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'title not found' USING ERRCODE = 'P0002';
  END IF;

  v_any_flag := v_scr OR v_nex OR v_exc OR v_acq OR v_dist;

  -- 3. Publishing gates — fail-closed. Unpublishing bypasses.
  IF v_pub THEN
    IF v_title_status IS DISTINCT FROM 'ready_for_distribution'::public.content_status THEN
      RAISE EXCEPTION 'title must be ready_for_distribution to publish (current: %)',
        coalesce(v_title_status::text, 'null')
        USING ERRCODE = '22023';
    END IF;

    IF _new_status NOT IN (
      'screening_only'::public.title_commercial_status,
      'licensing_open'::public.title_commercial_status,
      'acquisition_open'::public.title_commercial_status,
      'invite_only'::public.title_commercial_status
    ) THEN
      RAISE EXCEPTION 'commercial_status % is not marketplace-eligible for publication',
        _new_status::text
        USING ERRCODE = '22023';
    END IF;

    IF NOT v_any_flag THEN
      RAISE EXCEPTION 'at least one availability flag must be true when publishing'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- 4. Snapshot previous state for audit
  SELECT * INTO v_prev
    FROM public.title_commercial_profiles
   WHERE title_id = _title_id;

  -- 5. Atomic upsert of status, published flag, and all five flags
  INSERT INTO public.title_commercial_profiles (
    title_id, owner_user_id,
    commercial_status, published_to_buyers,
    available_for_screeners,
    available_for_nonexclusive_license,
    available_for_exclusive_license,
    available_for_acquisition,
    available_for_distribution_partnership
  )
  VALUES (
    _title_id, v_owner,
    _new_status, v_pub,
    v_scr, v_nex, v_exc, v_acq, v_dist
  )
  ON CONFLICT (title_id) DO UPDATE
     SET commercial_status                     = EXCLUDED.commercial_status,
         published_to_buyers                   = EXCLUDED.published_to_buyers,
         available_for_screeners               = EXCLUDED.available_for_screeners,
         available_for_nonexclusive_license    = EXCLUDED.available_for_nonexclusive_license,
         available_for_exclusive_license       = EXCLUDED.available_for_exclusive_license,
         available_for_acquisition             = EXCLUDED.available_for_acquisition,
         available_for_distribution_partnership= EXCLUDED.available_for_distribution_partnership,
         updated_at                            = now()
  RETURNING * INTO v_next;

  -- 6. Single audit row with full snapshot
  INSERT INTO public.commercial_audit_log
    (actor_id, action, subject_user_id, details)
  VALUES (
    auth.uid(),
    'title_commercial_state.set',
    v_owner,
    jsonb_build_object(
      'title_id',                     _title_id,
      'content_title_status',         v_title_status::text,
      'previous_commercial_status',   coalesce(v_prev.commercial_status::text, null),
      'new_commercial_status',        v_next.commercial_status::text,
      'previous_published_to_buyers', coalesce(v_prev.published_to_buyers, false),
      'new_published_to_buyers',      v_next.published_to_buyers,
      'previous_flags', jsonb_build_object(
        'available_for_screeners',                coalesce(v_prev.available_for_screeners, false),
        'available_for_nonexclusive_license',     coalesce(v_prev.available_for_nonexclusive_license, false),
        'available_for_exclusive_license',        coalesce(v_prev.available_for_exclusive_license, false),
        'available_for_acquisition',              coalesce(v_prev.available_for_acquisition, false),
        'available_for_distribution_partnership', coalesce(v_prev.available_for_distribution_partnership, false)
      ),
      'new_flags', jsonb_build_object(
        'available_for_screeners',                v_next.available_for_screeners,
        'available_for_nonexclusive_license',     v_next.available_for_nonexclusive_license,
        'available_for_exclusive_license',        v_next.available_for_exclusive_license,
        'available_for_acquisition',              v_next.available_for_acquisition,
        'available_for_distribution_partnership', v_next.available_for_distribution_partnership
      ),
      'reason', v_reason
    )
  );

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_title_commercial_state(
  uuid, public.title_commercial_status, boolean,
  boolean, boolean, boolean, boolean, boolean, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_set_title_commercial_state(
  uuid, public.title_commercial_status, boolean,
  boolean, boolean, boolean, boolean, boolean, text
) TO authenticated;
