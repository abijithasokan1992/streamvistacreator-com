
REVOKE EXECUTE ON FUNCTION public.touch_updated_at_v2() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_dashboard_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.content_titles_lock_guard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_signup_as(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_dashboard_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_signup_as(text) TO authenticated;
