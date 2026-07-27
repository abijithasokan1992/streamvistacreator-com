-- =====================================================================
-- Separate security migration (PENDING — NOT auto-applied):
-- user_profiles privileged-field guard.
--
-- Scope note: this change was originally bundled with Batch 1 but is
-- OUT OF SCOPE for Batch 1 acceptance. It is quarantined here for
-- independent review under supabase/migrations-pending/. See
-- Batch 1 completion report for the separate change record.
--
-- Effect: BEFORE UPDATE trigger reverts privileged columns unless the
-- caller is service_role, admin, or super_admin. Non-privileged
-- profile fields remain freely user-editable via existing RLS.
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
