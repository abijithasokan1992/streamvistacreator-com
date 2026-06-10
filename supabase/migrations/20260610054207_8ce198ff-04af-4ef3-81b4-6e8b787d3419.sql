
-- Revoke broad EXECUTE on all SECURITY DEFINER helpers, then re-grant narrowly.

-- Trigger-only functions: no direct callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_intro_invite_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_onboarding_status_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_default_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Queue helpers: only edge functions (service_role) should call these
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- RLS-evaluation helpers: keep callable by signed-in users (needed for policy expressions), revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_producer_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.primary_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_producer_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.primary_role(uuid) TO authenticated, service_role;

-- Admin bootstrap helpers
REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_admin_if_none() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin_if_none() TO authenticated, service_role;

-- Referral attach: signed-in only
REVOKE EXECUTE ON FUNCTION public.attach_referral(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_referral(text, text) TO authenticated, service_role;

-- MFI seat counter: public read OK (shown on marketing page)
REVOKE EXECUTE ON FUNCTION public.mfi_seats_taken() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mfi_seats_taken() TO anon, authenticated, service_role;
