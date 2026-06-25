
-- Make audit trigger functions SECURITY DEFINER so they can insert into
-- entity_profile_audit_log (which only grants SELECT to authenticated and
-- has no INSERT RLS policy). The trigger fires after a creator updates
-- their own profile row, which is already permitted by RLS on entity_profiles.

ALTER FUNCTION public.log_entity_profile_changes() SECURITY DEFINER;
ALTER FUNCTION public.log_studio_ext_changes()      SECURITY DEFINER;

-- Lock down EXECUTE so only the trigger pathway uses these (defense in depth).
REVOKE ALL ON FUNCTION public.log_entity_profile_changes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_studio_ext_changes()      FROM PUBLIC;
