
-- Drop broad member SELECT policy; only writers/admins can read full rows (including hash/salt).
DROP POLICY IF EXISTS "Workspace members can view review links" ON public.review_links;

CREATE POLICY "Workspace writers can view review links"
ON public.review_links
FOR SELECT
TO authenticated
USING (public.can_write_workspace(workspace_id, auth.uid()));

-- Recreate the safe view as SECURITY DEFINER so workspace members can read
-- non-sensitive columns without needing direct SELECT on review_links.
DROP VIEW IF EXISTS public.review_links_safe;

CREATE VIEW public.review_links_safe
WITH (security_invoker = false) AS
SELECT
  rl.id, rl.workspace_id, rl.project_id, rl.created_by, rl.token,
  rl.asset_name, rl.asset_mime, rl.asset_size_bytes,
  rl.view_only, rl.expires_at, rl.max_views, rl.view_count,
  rl.revoked, rl.last_viewed_at, rl.created_at, rl.updated_at,
  (rl.password_hash IS NOT NULL) AS requires_password
FROM public.review_links rl
WHERE
  public.is_workspace_member(rl.workspace_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role);

GRANT SELECT ON public.review_links_safe TO authenticated;

-- Belt-and-braces: keep column-level revokes in place.
REVOKE SELECT (password_hash, password_salt) ON public.review_links FROM authenticated;
REVOKE SELECT (password_hash, password_salt) ON public.review_links FROM anon;
