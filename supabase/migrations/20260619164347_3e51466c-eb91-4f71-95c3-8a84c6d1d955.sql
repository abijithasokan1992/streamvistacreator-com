
-- 1. Add previous_status to support hold → restore
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS previous_status public.content_status;

-- 2. transition_title_status RPC
CREATE OR REPLACE FUNCTION public.transition_title_status(
  _title_id uuid,
  _to_status text,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_workspace uuid;
  t_status public.content_status;
  t_prev public.content_status;
  t_locked boolean;
  new_status public.content_status;
  allowed boolean := false;
  new_locked boolean;
  action_name text;
  restore_to public.content_status;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(uid, 'admin'::public.app_role)
          OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT owner_user_id, workspace_id, status, previous_status, locked
    INTO t_owner, t_workspace, t_status, t_prev, t_locked
  FROM public.content_titles WHERE id = _title_id FOR UPDATE;

  IF t_owner IS NULL THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;

  BEGIN
    new_status := _to_status::public.content_status;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid target status: %', _to_status USING ERRCODE = '22023';
  END;

  -- Transition matrix
  IF t_status = 'submitted' AND new_status IN ('in_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'in_review' AND new_status IN ('qc_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'qc_review' AND new_status IN ('legal_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'legal_review' AND new_status IN ('approved','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'approved' AND new_status IN ('published','hold') THEN allowed := true;
  ELSIF t_status = 'published' AND new_status IN ('archived','hold') THEN allowed := true;
  ELSIF t_status = 'hold' AND new_status NOT IN ('hold') THEN allowed := true; -- restore handled below
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Illegal transition: % → %', t_status, new_status USING ERRCODE = '22023';
  END IF;

  -- Locking: changes_requested unlocks; everything else (re)locks except archived
  IF new_status = 'changes_requested' THEN
    new_locked := false;
  ELSIF new_status IN ('archived') THEN
    new_locked := t_locked;
  ELSE
    new_locked := true;
  END IF;

  -- Hold preserves previous; restore from hold uses previous_status if target matches
  IF new_status = 'hold' THEN
    UPDATE public.content_titles
       SET previous_status = t_status,
           status = 'hold',
           locked = true,
           locked_at = now(),
           locked_by = uid,
           updated_at = now()
     WHERE id = _title_id;
  ELSE
    UPDATE public.content_titles
       SET status = new_status,
           previous_status = CASE WHEN t_status = 'hold' THEN NULL ELSE previous_status END,
           locked = new_locked,
           locked_at = CASE WHEN new_locked AND NOT t_locked THEN now() ELSE locked_at END,
           locked_by = CASE WHEN new_locked AND NOT t_locked THEN uid ELSE locked_by END,
           approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE approved_at END,
           approved_by = CASE WHEN new_status = 'approved' THEN uid ELSE approved_by END,
           published_at = CASE WHEN new_status = 'published' THEN now() ELSE published_at END,
           updated_at = now()
     WHERE id = _title_id;
  END IF;

  INSERT INTO public.content_approvals (title_id, actor_user_id, from_status, to_status, note)
  VALUES (_title_id, uid, t_status, new_status, _note);

  action_name := CASE new_status
    WHEN 'in_review' THEN 'title_in_review'
    WHEN 'qc_review' THEN 'title_qc_review'
    WHEN 'legal_review' THEN 'title_legal_review'
    WHEN 'approved' THEN 'title_approved'
    WHEN 'published' THEN 'title_published'
    WHEN 'rejected' THEN 'title_rejected'
    WHEN 'hold' THEN 'title_hold'
    WHEN 'changes_requested' THEN 'title_changes_requested'
    WHEN 'archived' THEN 'title_archived'
    ELSE 'title_status_changed'
  END;

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, target_user_id, target_email, action, details
  ) VALUES (
    uid,
    (SELECT email FROM auth.users WHERE id = uid),
    t_owner,
    (SELECT email FROM auth.users WHERE id = t_owner),
    action_name,
    jsonb_build_object(
      'title_id', _title_id,
      'organization_id', t_workspace,
      'from_status', t_status,
      'to_status', new_status,
      'note', _note,
      'created_at', now()
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'title_id', _title_id,
    'from_status', t_status,
    'to_status', new_status,
    'locked', new_locked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_title_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_title_status(uuid, text, text) TO authenticated, service_role;

-- 3. admin_review_queue
CREATE OR REPLACE FUNCTION public.admin_review_queue(_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  title text,
  status public.content_status,
  previous_status public.content_status,
  owner_user_id uuid,
  owner_email text,
  workspace_id uuid,
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  locked boolean,
  latest_note text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ct.id, ct.title, ct.status, ct.previous_status,
    ct.owner_user_id,
    (SELECT email FROM auth.users WHERE id = ct.owner_user_id) AS owner_email,
    ct.workspace_id, ct.submitted_at, ct.approved_at, ct.published_at, ct.locked,
    (SELECT note FROM public.content_approvals ca
       WHERE ca.title_id = ct.id ORDER BY created_at DESC LIMIT 1) AS latest_note,
    ct.updated_at
  FROM public.content_titles ct
  WHERE (public.has_role(auth.uid(),'admin'::public.app_role)
         OR public.is_super_admin(auth.uid()))
    AND (_status IS NULL OR ct.status::text = _status)
  ORDER BY ct.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_review_queue(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_queue(text) TO authenticated, service_role;

-- 4. admin_title_history
CREATE OR REPLACE FUNCTION public.admin_title_history(_title_id uuid)
RETURNS TABLE (
  kind text,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_email text,
  from_status text,
  to_status text,
  action text,
  note text,
  details jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    'approval'::text AS kind,
    ca.created_at AS occurred_at,
    ca.actor_user_id,
    (SELECT email FROM auth.users WHERE id = ca.actor_user_id) AS actor_email,
    ca.from_status::text,
    ca.to_status::text,
    NULL::text AS action,
    ca.note,
    NULL::jsonb AS details
  FROM public.content_approvals ca
  WHERE ca.title_id = _title_id
    AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  UNION ALL
  SELECT
    'audit'::text,
    al.created_at,
    al.admin_user_id,
    al.admin_email,
    al.details->>'from_status',
    al.details->>'to_status',
    al.action,
    al.details->>'note',
    al.details
  FROM public.admin_audit_log al
  WHERE (al.details->>'title_id') = _title_id::text
    AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  ORDER BY occurred_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_title_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_title_history(uuid) TO authenticated, service_role;
