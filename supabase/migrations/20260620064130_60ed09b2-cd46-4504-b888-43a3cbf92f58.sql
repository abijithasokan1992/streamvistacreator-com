
-- =========================================================
-- Stream 9: QC + Legal Review Operations
-- =========================================================

-- 1) title_review_assignments
CREATE TABLE IF NOT EXISTS public.title_review_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('qc','legal')),
  reviewer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_review_assignments TO authenticated;
GRANT ALL ON public.title_review_assignments TO service_role;
ALTER TABLE public.title_review_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage review assignments"
  ON public.title_review_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- 2) title_review_checklist (results per item)
CREATE TABLE IF NOT EXISTS public.title_review_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('qc','legal')),
  item_key text NOT NULL,
  item_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','pass','fail','needs_attention','not_applicable')),
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','non_blocking','blocking')),
  blocking boolean NOT NULL DEFAULT false,
  note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title_id, stage, item_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_review_checklist TO authenticated;
GRANT ALL ON public.title_review_checklist TO service_role;
ALTER TABLE public.title_review_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage review checklist"
  ON public.title_review_checklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- 3) title_review_notes (internal-only)
CREATE TABLE IF NOT EXISTS public.title_review_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_review_notes TO authenticated;
GRANT ALL ON public.title_review_notes TO service_role;
ALTER TABLE public.title_review_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage internal review notes"
  ON public.title_review_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- 4) title_review_issues (structured send-back / blocking issues)
CREATE TABLE IF NOT EXISTS public.title_review_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('qc','legal','general')),
  category_group text NOT NULL,
  category_key text NOT NULL,
  category_label text NOT NULL,
  severity text NOT NULL DEFAULT 'blocking'
    CHECK (severity IN ('info','non_blocking','blocking')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','withdrawn')),
  creator_note text,        -- shown to creator
  internal_note text,       -- admin-only
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_review_issues TO authenticated;
GRANT ALL ON public.title_review_issues TO service_role;
ALTER TABLE public.title_review_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage review issues"
  ON public.title_review_issues FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_review_issues_title_status
  ON public.title_review_issues (title_id, status);
CREATE INDEX IF NOT EXISTS idx_review_checklist_title_stage
  ON public.title_review_checklist (title_id, stage);

-- updated_at triggers
CREATE TRIGGER trg_review_assignments_touch BEFORE UPDATE ON public.title_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_review_checklist_touch BEFORE UPDATE ON public.title_review_checklist
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_review_issues_touch BEFORE UPDATE ON public.title_review_issues
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- RPCs
-- =========================================================

-- assign reviewer
CREATE OR REPLACE FUNCTION public.assign_title_reviewer(
  _title_id uuid, _stage text, _reviewer uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _stage NOT IN ('qc','legal') THEN
    RAISE EXCEPTION 'Invalid stage' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.title_review_assignments(title_id, stage, reviewer_user_id, assigned_by, assigned_at)
  VALUES (_title_id, _stage, _reviewer, uid, now())
  ON CONFLICT (title_id, stage) DO UPDATE
    SET reviewer_user_id = EXCLUDED.reviewer_user_id,
        assigned_by      = EXCLUDED.assigned_by,
        assigned_at      = now(),
        updated_at       = now();
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.assign_title_reviewer(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_title_reviewer(uuid,text,uuid) TO authenticated, service_role;

-- upsert checklist item
CREATE OR REPLACE FUNCTION public.upsert_title_checklist_item(
  _title_id uuid, _stage text, _item_key text, _item_label text,
  _status text, _severity text DEFAULT 'info', _blocking boolean DEFAULT false,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _stage NOT IN ('qc','legal') THEN
    RAISE EXCEPTION 'Invalid stage' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.title_review_checklist
    (title_id, stage, item_key, item_label, status, severity, blocking, note, reviewed_by, reviewed_at)
  VALUES
    (_title_id, _stage, _item_key, _item_label,
     COALESCE(_status,'pending'), COALESCE(_severity,'info'),
     COALESCE(_blocking,false), _note, uid, now())
  ON CONFLICT (title_id, stage, item_key) DO UPDATE
    SET item_label  = EXCLUDED.item_label,
        status      = EXCLUDED.status,
        severity    = EXCLUDED.severity,
        blocking    = EXCLUDED.blocking,
        note        = EXCLUDED.note,
        reviewed_by = uid,
        reviewed_at = now(),
        updated_at  = now();
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.upsert_title_checklist_item(uuid,text,text,text,text,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_title_checklist_item(uuid,text,text,text,text,text,boolean,text) TO authenticated, service_role;

-- internal note
CREATE OR REPLACE FUNCTION public.add_internal_review_note(
  _title_id uuid, _body text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); new_id uuid; em text;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN
    RAISE EXCEPTION 'Empty note' USING ERRCODE='22023';
  END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  INSERT INTO public.title_review_notes(title_id, author_user_id, author_email, body)
  VALUES (_title_id, uid, em, _body) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.add_internal_review_note(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_internal_review_note(uuid,text) TO authenticated, service_role;

-- add review issue
CREATE OR REPLACE FUNCTION public.add_review_issue(
  _title_id uuid, _stage text,
  _category_group text, _category_key text, _category_label text,
  _severity text DEFAULT 'blocking',
  _creator_note text DEFAULT NULL,
  _internal_note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); new_id uuid;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _stage NOT IN ('qc','legal','general') THEN
    RAISE EXCEPTION 'Invalid stage' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.title_review_issues
    (title_id, stage, category_group, category_key, category_label,
     severity, status, creator_note, internal_note, raised_by, raised_at)
  VALUES
    (_title_id, _stage, _category_group, _category_key, _category_label,
     COALESCE(_severity,'blocking'), 'open', _creator_note, _internal_note, uid, now())
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.add_review_issue(uuid,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_review_issue(uuid,text,text,text,text,text,text,text) TO authenticated, service_role;

-- resolve review issue
CREATE OR REPLACE FUNCTION public.resolve_review_issue(
  _issue_id uuid, _resolution_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  UPDATE public.title_review_issues
     SET status = 'resolved',
         resolved_by = uid,
         resolved_at = now(),
         resolution_note = _resolution_note,
         updated_at = now()
   WHERE id = _issue_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.resolve_review_issue(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_review_issue(uuid,text) TO authenticated, service_role;

-- request_title_changes: orchestrates send-back
CREATE OR REPLACE FUNCTION public.request_title_changes(
  _title_id uuid,
  _reasons jsonb,            -- array of { group, key, label, severity, creator_note, internal_note, stage }
  _creator_summary text,
  _internal_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r jsonb;
  cnt int := 0;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _reasons IS NULL OR jsonb_typeof(_reasons) <> 'array' OR jsonb_array_length(_reasons) = 0 THEN
    RAISE EXCEPTION 'At least one structured reason is required' USING ERRCODE='22023';
  END IF;
  IF _creator_summary IS NULL OR length(trim(_creator_summary)) = 0 THEN
    RAISE EXCEPTION 'Creator-facing summary is required' USING ERRCODE='22023';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(_reasons) LOOP
    PERFORM public.add_review_issue(
      _title_id,
      COALESCE(r->>'stage','general'),
      COALESCE(r->>'group','general'),
      COALESCE(r->>'key','other'),
      COALESCE(r->>'label','Other'),
      COALESCE(r->>'severity','blocking'),
      NULLIF(r->>'creator_note',''),
      NULLIF(r->>'internal_note','')
    );
    cnt := cnt + 1;
  END LOOP;

  IF _internal_note IS NOT NULL AND length(trim(_internal_note)) > 0 THEN
    PERFORM public.add_internal_review_note(_title_id, _internal_note);
  END IF;

  -- delegate to transition (also writes content_approvals + notification)
  PERFORM public.transition_title_status(_title_id, 'changes_requested', _creator_summary);

  RETURN jsonb_build_object('ok', true, 'issues_created', cnt);
END $$;
REVOKE ALL ON FUNCTION public.request_title_changes(uuid,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_title_changes(uuid,jsonb,text,text) TO authenticated, service_role;

-- review summary (admin)
CREATE OR REPLACE FUNCTION public.title_review_summary(_title_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  qc_total int; qc_done int;
  lg_total int; lg_done int;
  qc_blocking int; lg_blocking int;
  qc_reviewer uuid; lg_reviewer uuid;
  qc_email text; lg_email text;
  last_upd timestamptz;
  last_issue jsonb;
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('pass','not_applicable'))
    INTO qc_total, qc_done FROM public.title_review_checklist
    WHERE title_id = _title_id AND stage='qc';
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('pass','not_applicable'))
    INTO lg_total, lg_done FROM public.title_review_checklist
    WHERE title_id = _title_id AND stage='legal';

  SELECT COUNT(*) INTO qc_blocking
    FROM public.title_review_issues
    WHERE title_id=_title_id AND stage='qc' AND status='open' AND severity='blocking';
  SELECT COUNT(*) INTO lg_blocking
    FROM public.title_review_issues
    WHERE title_id=_title_id AND stage IN ('legal','general') AND status='open' AND severity='blocking';

  SELECT reviewer_user_id INTO qc_reviewer FROM public.title_review_assignments
    WHERE title_id=_title_id AND stage='qc';
  SELECT reviewer_user_id INTO lg_reviewer FROM public.title_review_assignments
    WHERE title_id=_title_id AND stage='legal';
  SELECT email INTO qc_email FROM auth.users WHERE id = qc_reviewer;
  SELECT email INTO lg_email FROM auth.users WHERE id = lg_reviewer;

  SELECT GREATEST(
    COALESCE((SELECT MAX(updated_at) FROM public.title_review_checklist WHERE title_id=_title_id), 'epoch'),
    COALESCE((SELECT MAX(updated_at) FROM public.title_review_issues WHERE title_id=_title_id), 'epoch'),
    COALESCE((SELECT MAX(created_at) FROM public.title_review_notes WHERE title_id=_title_id), 'epoch')
  ) INTO last_upd;

  SELECT to_jsonb(i.*) INTO last_issue FROM (
    SELECT category_label, stage, severity, creator_note, raised_at
      FROM public.title_review_issues
     WHERE title_id=_title_id AND status='open'
     ORDER BY raised_at DESC LIMIT 1
  ) i;

  RETURN jsonb_build_object(
    'qc', jsonb_build_object(
      'total', qc_total, 'done', qc_done, 'blocking_open', qc_blocking,
      'reviewer_user_id', qc_reviewer, 'reviewer_email', qc_email,
      'completion_pct', CASE WHEN qc_total=0 THEN 0 ELSE round((qc_done::numeric/qc_total)*100) END
    ),
    'legal', jsonb_build_object(
      'total', lg_total, 'done', lg_done, 'blocking_open', lg_blocking,
      'reviewer_user_id', lg_reviewer, 'reviewer_email', lg_email,
      'completion_pct', CASE WHEN lg_total=0 THEN 0 ELSE round((lg_done::numeric/lg_total)*100) END
    ),
    'review_clear', (qc_blocking + lg_blocking) = 0,
    'last_update', last_upd,
    'last_open_issue', last_issue
  );
END $$;
REVOKE ALL ON FUNCTION public.title_review_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.title_review_summary(uuid) TO authenticated, service_role;

-- creator-safe feedback: returns ONLY creator-visible fields for the title's owner or admins.
CREATE OR REPLACE FUNCTION public.creator_review_feedback(_title_id uuid)
RETURNS TABLE (
  id uuid, stage text, category_group text, category_label text,
  severity text, status text, creator_note text, raised_at timestamptz, resolved_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  SELECT owner_user_id INTO owner FROM public.content_titles WHERE id = _title_id;
  IF owner IS NULL THEN RETURN; END IF;
  IF owner <> uid
     AND NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  RETURN QUERY
    SELECT i.id, i.stage, i.category_group, i.category_label,
           i.severity, i.status, i.creator_note, i.raised_at, i.resolved_at
      FROM public.title_review_issues i
     WHERE i.title_id = _title_id
     ORDER BY i.raised_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.creator_review_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_review_feedback(uuid) TO authenticated, service_role;

-- list admin candidate reviewers
CREATE OR REPLACE FUNCTION public.list_review_candidates()
RETURNS TABLE (user_id uuid, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ur.user_id, u.email, ur.role::text
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
     WHERE ur.role IN ('admin','super_admin')
     ORDER BY u.email;
END $$;
REVOKE ALL ON FUNCTION public.list_review_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_review_candidates() TO authenticated, service_role;

-- =========================================================
-- Transition guardrails — block approved / ready_for_distribution
-- =========================================================
CREATE OR REPLACE FUNCTION public.transition_title_status(_title_id uuid, _to_status text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  blocking_open int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT (public.has_role(uid, 'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT owner_user_id, workspace_id, status, previous_status, locked
    INTO t_owner, t_workspace, t_status, t_prev, t_locked
  FROM public.content_titles WHERE id = _title_id FOR UPDATE;
  IF t_owner IS NULL THEN RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002'; END IF;

  BEGIN new_status := _to_status::public.content_status;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid target status: %', _to_status USING ERRCODE = '22023';
  END;

  IF t_status = 'submitted'    AND new_status IN ('in_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'in_review'    AND new_status IN ('qc_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'qc_review'    AND new_status IN ('legal_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'legal_review' AND new_status IN ('approved','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'approved'     AND new_status IN ('ready_for_distribution','hold') THEN allowed := true;
  ELSIF t_status = 'ready_for_distribution' AND new_status IN ('hold','archived') THEN allowed := true;
  ELSIF t_status = 'hold'         AND new_status NOT IN ('hold') THEN allowed := true;
  ELSIF t_status = 'changes_requested' AND new_status IN ('submitted','rejected','hold') THEN allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Illegal transition: % → %', t_status, new_status USING ERRCODE = '22023';
  END IF;

  -- GUARDRAIL: cannot move into approved / ready_for_distribution
  -- while any open blocking issue exists (across qc/legal/general)
  IF new_status IN ('approved','ready_for_distribution') THEN
    SELECT COUNT(*) INTO blocking_open
      FROM public.title_review_issues
     WHERE title_id = _title_id AND status='open' AND severity='blocking';
    IF blocking_open > 0 THEN
      RAISE EXCEPTION 'Cannot move to %: % blocking review issue(s) still open. Resolve them first.',
        new_status, blocking_open USING ERRCODE = '22023';
    END IF;
    -- and any blocking checklist item that is fail/needs_attention/pending
    SELECT COUNT(*) INTO blocking_open
      FROM public.title_review_checklist
     WHERE title_id = _title_id AND blocking = true
       AND status NOT IN ('pass','not_applicable');
    IF blocking_open > 0 THEN
      RAISE EXCEPTION 'Cannot move to %: % blocking checklist item(s) unresolved.',
        new_status, blocking_open USING ERRCODE = '22023';
    END IF;
  END IF;

  IF new_status = 'changes_requested' THEN new_locked := false;
  ELSIF new_status IN ('archived') THEN new_locked := t_locked;
  ELSE new_locked := true;
  END IF;

  IF new_status = 'hold' THEN
    UPDATE public.content_titles
       SET previous_status = t_status, status = 'hold',
           locked = true, locked_at = now(), locked_by = uid, updated_at = now()
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
    WHEN 'ready_for_distribution' THEN 'title_ready_for_distribution'
    WHEN 'rejected' THEN 'title_rejected'
    WHEN 'hold' THEN 'title_hold'
    WHEN 'changes_requested' THEN 'title_changes_requested'
    WHEN 'archived' THEN 'title_archived'
    ELSE 'title_status_changed'
  END;

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, target_user_id, target_email, action, details
  ) VALUES (
    uid, (SELECT email FROM auth.users WHERE id = uid),
    t_owner, (SELECT email FROM auth.users WHERE id = t_owner),
    action_name,
    jsonb_build_object(
      'title_id', _title_id, 'organization_id', t_workspace,
      'from_status', t_status, 'to_status', new_status,
      'note', _note, 'created_at', now()
    )
  );

  RETURN jsonb_build_object(
    'ok', true, 'title_id', _title_id,
    'from_status', t_status, 'to_status', new_status, 'locked', new_locked
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.transition_title_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_title_status(uuid, text, text) TO authenticated, service_role;
