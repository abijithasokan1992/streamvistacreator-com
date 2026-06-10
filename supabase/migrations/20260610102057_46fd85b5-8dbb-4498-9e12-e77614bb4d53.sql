
CREATE TABLE public.review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  upload_id uuid REFERENCES public.recent_uploads(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  -- Denormalized asset metadata so links survive upload row deletions
  asset_name text NOT NULL,
  asset_mime text,
  asset_size_bytes bigint,
  asset_object_key text,
  asset_par_url text,
  asset_par_expires_at timestamptz,
  -- Access control
  password_hash text,
  password_salt text,
  expires_at timestamptz,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  view_only boolean NOT NULL DEFAULT true,
  revoked boolean NOT NULL DEFAULT false,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX review_links_workspace_idx ON public.review_links(workspace_id);
CREATE INDEX review_links_project_idx ON public.review_links(project_id);
CREATE INDEX review_links_token_idx ON public.review_links(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_links TO authenticated;
GRANT ALL ON public.review_links TO service_role;

ALTER TABLE public.review_links ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their workspace's review links
CREATE POLICY "Workspace members can view review links"
ON public.review_links
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Only writers (owner/admin/editor) can create
CREATE POLICY "Workspace writers can create review links"
ON public.review_links
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_write_workspace(workspace_id, auth.uid())
  AND created_by = auth.uid()
);

-- Only writers can update
CREATE POLICY "Workspace writers can update review links"
ON public.review_links
FOR UPDATE
TO authenticated
USING (public.can_write_workspace(workspace_id, auth.uid()))
WITH CHECK (public.can_write_workspace(workspace_id, auth.uid()));

-- Only writers can delete
CREATE POLICY "Workspace writers can delete review links"
ON public.review_links
FOR DELETE
TO authenticated
USING (public.can_write_workspace(workspace_id, auth.uid()));

-- updated_at trigger (reuse existing touch_updated_at)
CREATE TRIGGER review_links_touch_updated_at
BEFORE UPDATE ON public.review_links
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
