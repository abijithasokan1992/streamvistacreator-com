
REVOKE EXECUTE ON FUNCTION public.can_edit_entity_profile(TEXT, UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_entity_profile(TEXT, UUID, UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_edit_entity_profile_by_id(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_entity_profile_by_id(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.recompute_entity_profile_completion() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_edit_entity_profile(TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_entity_profile(TEXT, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_entity_profile_by_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_entity_profile_by_id(UUID) TO authenticated, service_role;
