
-- =========================================================================
-- Batch 4 pre-work: commercials defence-in-depth (INSERT + UPDATE)
-- =========================================================================

-- 1) distribution_program_offers: reject INSERTs from non-privileged sessions.
-- RLS already forbids this, but a defense-in-depth trigger blocks it even if
-- a future policy accidentally loosens INSERT scope.
CREATE OR REPLACE FUNCTION public.enforce_dpo_insert_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := current_setting('role', true);
BEGIN
  IF v_role IN ('service_role','supabase_admin','postgres') THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NOT NULL AND (
       public.has_role(v_uid,'admin'::app_role)
    OR public.has_role(v_uid,'super_admin'::app_role)
    OR public.has_role(v_uid,'platform_owner'::app_role)
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only administrators may issue distribution program offers.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_dpo_insert_admin_only ON public.distribution_program_offers;
CREATE TRIGGER trg_enforce_dpo_insert_admin_only
BEFORE INSERT ON public.distribution_program_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_dpo_insert_admin_only();

-- 2) title_commercial_profiles: lock pricing / entitlement fields to admin
-- on BOTH insert and update. Owner reads are still allowed by the SELECT
-- policy; writes are already admin-only via RLS, but this trigger enforces
-- the invariant at the row level even if the client is service_role acting
-- on behalf of a non-privileged user through an edge function.
CREATE OR REPLACE FUNCTION public.enforce_tcp_commercials_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text := current_setting('role', true);
  v_is_privileged boolean := false;
BEGIN
  IF v_role IN ('service_role','supabase_admin','postgres') THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL AND (
       public.has_role(v_uid,'admin'::app_role)
    OR public.has_role(v_uid,'super_admin'::app_role)
    OR public.has_role(v_uid,'platform_owner'::app_role)
  ) THEN
    v_is_privileged := true;
  END IF;

  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  -- INSERT path: non-admin can only create a stub row scoped to themselves
  -- with default commercial fields. Any attempt to set non-default pricing /
  -- entitlement is rejected.
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Cannot create a commercial profile owned by another user.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.creator_tier <> 'free'
       OR NEW.deal_mode <> 'admin_managed'::deal_mode
       OR NEW.protection_tier <> 'baseline'::protection_tier
       OR NEW.commercial_status <> 'not_open'::title_commercial_status
       OR NEW.acquisition_open
       OR NEW.licensing_open
       OR NEW.distribution_open
       OR NEW.screening_allowed
       OR NEW.available_for_screeners
       OR NEW.available_for_nonexclusive_license
       OR NEW.available_for_exclusive_license
       OR NEW.available_for_acquisition
       OR NEW.available_for_distribution_partnership
       OR NEW.published_to_buyers
       OR NEW.admin_approval_required = false
    THEN
      RAISE EXCEPTION 'Commercial terms, pricing tiers, and entitlement flags are administrator-only.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path: freeze every pricing / entitlement field.
  IF NEW.creator_tier                             IS DISTINCT FROM OLD.creator_tier
  OR NEW.deal_mode                                IS DISTINCT FROM OLD.deal_mode
  OR NEW.protection_tier                          IS DISTINCT FROM OLD.protection_tier
  OR NEW.commercial_status                        IS DISTINCT FROM OLD.commercial_status
  OR NEW.acquisition_open                         IS DISTINCT FROM OLD.acquisition_open
  OR NEW.licensing_open                           IS DISTINCT FROM OLD.licensing_open
  OR NEW.distribution_open                        IS DISTINCT FROM OLD.distribution_open
  OR NEW.screening_allowed                        IS DISTINCT FROM OLD.screening_allowed
  OR NEW.admin_approval_required                  IS DISTINCT FROM OLD.admin_approval_required
  OR NEW.creator_final_approval_required          IS DISTINCT FROM OLD.creator_final_approval_required
  OR NEW.available_for_screeners                  IS DISTINCT FROM OLD.available_for_screeners
  OR NEW.available_for_nonexclusive_license       IS DISTINCT FROM OLD.available_for_nonexclusive_license
  OR NEW.available_for_exclusive_license          IS DISTINCT FROM OLD.available_for_exclusive_license
  OR NEW.available_for_acquisition                IS DISTINCT FROM OLD.available_for_acquisition
  OR NEW.available_for_distribution_partnership   IS DISTINCT FROM OLD.available_for_distribution_partnership
  OR NEW.published_to_buyers                      IS DISTINCT FROM OLD.published_to_buyers
  OR NEW.owner_user_id                            IS DISTINCT FROM OLD.owner_user_id
  OR NEW.title_id                                 IS DISTINCT FROM OLD.title_id
  THEN
    RAISE EXCEPTION 'Commercial terms, pricing tiers, and entitlement flags are administrator-only.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_tcp_commercials_admin_only ON public.title_commercial_profiles;
CREATE TRIGGER trg_enforce_tcp_commercials_admin_only
BEFORE INSERT OR UPDATE ON public.title_commercial_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_tcp_commercials_admin_only();
