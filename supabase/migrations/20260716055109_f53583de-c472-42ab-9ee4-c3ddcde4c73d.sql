
GRANT EXECUTE ON FUNCTION public.delete_creator_title(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.title_delete_eligibility(uuid) TO authenticated;

-- Fallback direct DELETE for own drafts (RPC remains the primary path; this covers
-- future client paths and matches the "owner deletes their own draft" intent).
DROP POLICY IF EXISTS ct_delete_owner_draft ON public.content_titles;
CREATE POLICY ct_delete_owner_draft ON public.content_titles
  FOR DELETE TO authenticated
  USING (
    owner_user_id = auth.uid()
    AND status = 'draft'::content_status
    AND (locked IS NULL OR locked = false)
    AND approved_at IS NULL
    AND published_at IS NULL
  );
