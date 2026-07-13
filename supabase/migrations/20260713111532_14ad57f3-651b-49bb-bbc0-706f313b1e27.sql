-- Replace the previous owner-scope trigger with a strict transition allowlist.
CREATE OR REPLACE FUNCTION public.enforce_content_title_owner_write_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  allowed_new content_status[] := ARRAY[
    'draft'::content_status,
    'submitted'::content_status,
    'changes_requested'::content_status
  ];
BEGIN
  -- Admins bypass all creator restrictions. Role check reads from
  -- public.user_roles (never from editable auth.users.user_metadata).
  is_admin := has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid());
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admins must own the row; ownership must not be reassigned.
  IF OLD.owner_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_title_owner';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'cannot_reassign_owner';
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'cannot_move_workspace';
  END IF;

  -- Creators can only edit while the title is in draft or changes_requested.
  -- Anything past that (submitted, in_review, qc_review, legal_review,
  -- approved, ready_for_distribution, locked, published, rejected, hold,
  -- archived, incomplete) is admin/editorial-only.
  IF OLD.status NOT IN ('draft'::content_status, 'changes_requested'::content_status) THEN
    RAISE EXCEPTION 'creator_cannot_edit_after_submission'
      USING HINT = format('Title is in %s; only editorial can modify it.', OLD.status);
  END IF;

  -- New status must be one of the creator-allowed values, and the specific
  -- transition must be on the allowlist.
  IF NEW.status IS NULL OR NOT (NEW.status = ANY (allowed_new)) THEN
    RAISE EXCEPTION 'creator_status_not_allowed'
      USING HINT = 'Creators may only set status to draft, submitted, or changes_requested.';
  END IF;

  IF NOT (
       (OLD.status = 'draft'             AND NEW.status IN ('draft'::content_status, 'submitted'::content_status))
    OR (OLD.status = 'changes_requested' AND NEW.status IN ('changes_requested'::content_status, 'submitted'::content_status))
  ) THEN
    RAISE EXCEPTION 'invalid_creator_transition'
      USING HINT = format('Transition %s -> %s is not allowed for creators.', OLD.status, NEW.status);
  END IF;

  -- Review / publication / legal fields are admin-only regardless of status.
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'creator_cannot_write_review_columns'
      USING HINT = 'approved_at, approved_by, and published_at are admin-only.';
  END IF;

  -- Creators can never clear the editorial lock, and cannot toggle lock at all.
  IF NEW.locked IS DISTINCT FROM OLD.locked THEN
    RAISE EXCEPTION 'creator_cannot_change_lock'
      USING HINT = 'Only admins can change the editorial lock state.';
  END IF;
  IF NEW.locked_by IS DISTINCT FROM OLD.locked_by
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
    RAISE EXCEPTION 'creator_cannot_change_lock_metadata';
  END IF;

  -- Guard workflow bookkeeping columns.
  IF NEW.previous_status IS DISTINCT FROM OLD.previous_status
     OR NEW.requested_from_stage IS DISTINCT FROM OLD.requested_from_stage THEN
    RAISE EXCEPTION 'creator_cannot_change_workflow_metadata';
  END IF;

  -- Stamp submitted_at on the draft/changes_requested -> submitted transition.
  IF NEW.status = 'submitted'::content_status AND OLD.status <> 'submitted'::content_status THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- Tighten the WITH CHECK on the owner UPDATE policy to align with the trigger.
DROP POLICY IF EXISTS ct_update_owner_or_admin ON public.content_titles;
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
      AND status IN ('draft'::content_status, 'submitted'::content_status, 'changes_requested'::content_status)
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND published_at IS NULL
    )
  );

-- Also tighten the owner INSERT policy: creators can only create drafts.
DROP POLICY IF EXISTS ct_insert_owner_or_admin ON public.content_titles;
CREATE POLICY ct_insert_owner_or_admin
  ON public.content_titles
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_super_admin(auth.uid())
    OR (
      owner_user_id = auth.uid()
      AND status = 'draft'::content_status
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND published_at IS NULL
      AND (locked IS NULL OR locked = true)
    )
  );

DROP TRIGGER IF EXISTS trg_content_titles_owner_scope ON public.content_titles;
CREATE TRIGGER trg_content_titles_owner_scope
  BEFORE UPDATE ON public.content_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_content_title_owner_write_scope();