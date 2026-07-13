
-- 1) Add published_by editorial audit column (if not already present).
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id);

-- 2) Tighten INSERT policy: creators cannot set published_by either.
DROP POLICY IF EXISTS ct_insert_owner_or_admin ON public.content_titles;
CREATE POLICY ct_insert_owner_or_admin ON public.content_titles
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
      AND published_by IS NULL
      AND (locked IS NULL OR locked = true)
    )
  );

-- 3) Tighten UPDATE policy: creators cannot leave published_by set.
DROP POLICY IF EXISTS ct_update_owner_or_admin ON public.content_titles;
CREATE POLICY ct_update_owner_or_admin ON public.content_titles
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
      AND status = ANY (ARRAY['draft'::content_status,'submitted'::content_status,'changes_requested'::content_status])
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND published_at IS NULL
      AND published_by IS NULL
    )
  );

-- 4) Rewrite the write-scope trigger function to enforce:
--    - creator restrictions (unchanged)
--    - creator cannot write published_by / owner_user_id / workspace_id
--    - admin publication sequence (must reach approved before published)
--    - workspace admins scoped to their own workspace
CREATE OR REPLACE FUNCTION public.enforce_content_title_owner_write_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_platform_admin boolean;
  is_ws_admin boolean;
  allowed_new content_status[] := ARRAY[
    'draft'::content_status,
    'submitted'::content_status,
    'changes_requested'::content_status
  ];
BEGIN
  -- Platform-level admin (roles table only, never user_metadata).
  is_platform_admin := has_role(uid, 'admin'::app_role) OR is_super_admin(uid);

  -- Workspace-scoped admin (via workspace_members). Only counts when acting
  -- on a row inside that workspace.
  is_ws_admin := (
    TG_OP = 'UPDATE'
    AND OLD.workspace_id IS NOT NULL
    AND public.is_workspace_admin(uid, OLD.workspace_id)
  );

  -- ================= ADMIN PATH =================
  IF is_platform_admin OR is_ws_admin THEN
    -- Workspace admins cannot move a title to another workspace.
    IF NOT is_platform_admin AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'workspace_admin_cannot_move_workspace';
    END IF;

    -- Publication sequence: only approved -> published is permitted.
    IF NEW.status = 'published'::content_status
       AND OLD.status IS DISTINCT FROM 'published'::content_status
       AND OLD.status <> 'approved'::content_status THEN
      RAISE EXCEPTION 'title_must_be_approved_before_publication'
        USING HINT = format('Cannot publish from %s; approve the title first.', OLD.status);
    END IF;

    -- Withdrawal from published: only to approved or archived.
    IF OLD.status = 'published'::content_status
       AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('approved'::content_status, 'archived'::content_status) THEN
      RAISE EXCEPTION 'invalid_withdrawal_from_published'
        USING HINT = 'Published titles may only move to approved or archived.';
    END IF;

    -- Stamp editorial audit columns.
    IF NEW.status = 'approved'::content_status
       AND OLD.status IS DISTINCT FROM 'approved'::content_status THEN
      NEW.approved_at := COALESCE(NEW.approved_at, now());
      NEW.approved_by := COALESCE(NEW.approved_by, uid);
    END IF;
    IF NEW.status = 'published'::content_status
       AND OLD.status IS DISTINCT FROM 'published'::content_status THEN
      NEW.published_at := COALESCE(NEW.published_at, now());
      NEW.published_by := COALESCE(NEW.published_by, uid);
    END IF;

    RETURN NEW;
  END IF;

  -- ================= CREATOR PATH =================
  IF OLD.owner_user_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'not_title_owner';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'cannot_reassign_owner';
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'cannot_move_workspace';
  END IF;

  IF OLD.status NOT IN ('draft'::content_status, 'changes_requested'::content_status) THEN
    RAISE EXCEPTION 'creator_cannot_edit_after_submission'
      USING HINT = format('Title is in %s; only editorial can modify it.', OLD.status);
  END IF;

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

  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.published_at IS DISTINCT FROM OLD.published_at
     OR NEW.published_by IS DISTINCT FROM OLD.published_by THEN
    RAISE EXCEPTION 'creator_cannot_write_review_columns'
      USING HINT = 'approved_at, approved_by, published_at and published_by are admin-only.';
  END IF;

  IF NEW.locked IS DISTINCT FROM OLD.locked THEN
    RAISE EXCEPTION 'creator_cannot_change_lock';
  END IF;
  IF NEW.locked_by IS DISTINCT FROM OLD.locked_by
     OR NEW.locked_at IS DISTINCT FROM OLD.locked_at THEN
    RAISE EXCEPTION 'creator_cannot_change_lock_metadata';
  END IF;

  IF NEW.previous_status IS DISTINCT FROM OLD.previous_status
     OR NEW.requested_from_stage IS DISTINCT FROM OLD.requested_from_stage THEN
    RAISE EXCEPTION 'creator_cannot_change_workflow_metadata';
  END IF;

  IF NEW.status = 'submitted'::content_status AND OLD.status <> 'submitted'::content_status THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) INSERT guard trigger: block any non-draft initial status regardless of
--    who is inserting (RLS + trigger belt-and-suspenders). Also blocks any
--    direct REST / RPC path from creating a row already in published state.
CREATE OR REPLACE FUNCTION public.enforce_content_title_insert_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'draft'::content_status THEN
    RAISE EXCEPTION 'titles_must_start_as_draft'
      USING HINT = 'New titles must be created in draft; move them through the workflow to publish.';
  END IF;
  IF NEW.approved_at IS NOT NULL OR NEW.approved_by IS NOT NULL
     OR NEW.published_at IS NOT NULL OR NEW.published_by IS NOT NULL THEN
    RAISE EXCEPTION 'titles_cannot_be_created_pre_approved';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_content_titles_insert_scope ON public.content_titles;
CREATE TRIGGER trg_content_titles_insert_scope
  BEFORE INSERT ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_title_insert_scope();
