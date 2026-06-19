
-- 1. Drop overly permissive policies
DROP POLICY IF EXISTS ct_buyer_read_published ON public.content_titles;
DROP POLICY IF EXISTS vouchers_targeted_read ON public.vouchers;

-- 2. Recreate vouchers SELECT scoped to the specific target user only
CREATE POLICY vouchers_targeted_read
  ON public.vouchers
  FOR SELECT
  TO authenticated
  USING (is_active AND target_user_id = auth.uid());

-- 3. Lock down sensitive review_links columns at the column-grant level.
--    Service role (edge functions) retains full access; clients can still
--    read safe metadata columns through the existing row-level policies.
REVOKE SELECT (asset_par_url, asset_object_key, asset_par_expires_at)
  ON public.review_links FROM authenticated;
REVOKE SELECT (asset_par_url, asset_object_key, asset_par_expires_at)
  ON public.review_links FROM anon;
