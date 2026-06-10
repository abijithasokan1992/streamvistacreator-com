
DROP VIEW IF EXISTS public.review_links_safe;

CREATE VIEW public.review_links_safe
WITH (security_invoker = true) AS
SELECT
  rl.id, rl.workspace_id, rl.project_id, rl.created_by, rl.token,
  rl.asset_name, rl.asset_mime, rl.asset_size_bytes,
  rl.view_only, rl.expires_at, rl.max_views, rl.view_count,
  rl.revoked, rl.last_viewed_at, rl.created_at, rl.updated_at,
  (rl.password_hash IS NOT NULL) AS requires_password
FROM public.review_links rl;

GRANT SELECT ON public.review_links_safe TO authenticated;

-- Members get row access (RLS), but cannot select password_hash/salt (column GRANT).
CREATE POLICY "Workspace members can view review links (safe cols)"
ON public.review_links
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

REVOKE SELECT (password_hash, password_salt) ON public.review_links FROM authenticated;
REVOKE SELECT (password_hash, password_salt) ON public.review_links FROM anon;
