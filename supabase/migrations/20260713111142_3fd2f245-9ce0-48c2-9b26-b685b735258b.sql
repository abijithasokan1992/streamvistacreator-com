DROP POLICY IF EXISTS ct_owner_rw ON public.content_titles;

CREATE POLICY ct_select_owner_or_admin
  ON public.content_titles
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY ct_insert_owner_or_admin
  ON public.content_titles
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
    OR (
      owner_user_id = auth.uid()
      AND status IN ('draft'::content_status, 'changes_requested'::content_status)
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND published_at IS NULL
      AND locked IS NOT FALSE
    )
  );

CREATE POLICY ct_update_owner_or_admin
  ON public.content_titles
  FOR UPDATE
  USING (
    owner_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
    OR (
      owner_user_id = auth.uid()
      AND status NOT IN ('approved'::content_status, 'published'::content_status)
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND published_at IS NULL
    )
  );

CREATE POLICY ct_delete_admin
  ON public.content_titles
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.enforce_content_title_owner_write_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid());
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('approved'::content_status, 'published'::content_status) THEN
    RAISE EXCEPTION 'owner_cannot_self_approve'
      USING HINT = 'Only admins can approve or publish a title.';
  END IF;

  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'owner_cannot_write_review_columns'
      USING HINT = 'approved_at, approved_by, and published_at are admin-only.';
  END IF;

  IF NEW.locked IS DISTINCT FROM OLD.locked AND NEW.locked = false THEN
    RAISE EXCEPTION 'owner_cannot_unlock_title'
      USING HINT = 'Only admins can clear the editorial lock.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_content_titles_owner_scope ON public.content_titles;
CREATE TRIGGER trg_content_titles_owner_scope
  BEFORE UPDATE ON public.content_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_content_title_owner_write_scope();