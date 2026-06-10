-- Restrict review_links SELECT: only workspace WRITERS (owner/admin/editor) and admins can read
-- the row (which contains pre-signed asset_par_url / asset_object_key). Viewer-role members
-- access reviews through the public share-token edge function path, not via RLS.
DROP POLICY IF EXISTS "Workspace members can view review links (safe cols)" ON public.review_links;