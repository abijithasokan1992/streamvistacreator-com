
-- =========================================================
-- Stream 10: Resubmission loop + security hardening
-- =========================================================

-- 1) Persist originating review stage on content_titles
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS requested_from_stage text
    CHECK (requested_from_stage IS NULL OR requested_from_stage IN ('qc_review','legal_review','in_review','submitted'));

COMMENT ON COLUMN public.content_titles.requested_from_stage IS
  'When status = changes_requested, this remembers which review stage the title should return to on resubmission.';

-- 2) Patch request_title_changes to record the originating stage BEFORE transitioning.
CREATE OR REPLACE FUNCTION public.request_title_changes(
  _title_id uuid,
  _reasons jsonb,
  _creator_summary text,
  _internal_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r jsonb;
  cnt int := 0;
  current_status text;
  remembered text;
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

  -- Remember originating stage (qc_review / legal_review / in_review / submitted)
  SELECT status::text INTO current_status FROM public.content_titles WHERE id = _title_id;
  IF current_status IN ('qc_review','legal_review','in_review','submitted') THEN
    remembered := current_status;
  ELSE
    remembered := 'in_review';
  END IF;
  UPDATE public.content_titles
     SET requested_from_stage = remembered, updated_at = now()
   WHERE id = _title_id;

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

  PERFORM public.transition_title_status(_title_id, 'changes_requested', _creator_summary);

  RETURN jsonb_build_object('ok', true, 'issues_created', cnt, 'requested_from_stage', remembered);
END $$;
REVOKE ALL ON FUNCTION public.request_title_changes(uuid,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_title_changes(uuid,jsonb,text,text) TO authenticated, service_role;

-- 3) Creator resubmission RPC — owner-only, restores originating stage.
CREATE OR REPLACE FUNCTION public.creator_resubmit_title(
  _title_id uuid,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_status text;
  target text;
  open_blocking int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;

  SELECT owner_user_id, status::text, COALESCE(requested_from_stage,'in_review')
    INTO t_owner, t_status, target
  FROM public.content_titles WHERE id = _title_id FOR UPDATE;

  IF t_owner IS NULL THEN RAISE EXCEPTION 'Title not found' USING ERRCODE='P0002'; END IF;
  IF t_owner <> uid THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF t_status <> 'changes_requested' THEN
    RAISE EXCEPTION 'Title is not in changes_requested state' USING ERRCODE='22023';
  END IF;

  -- Auto-resolve open issues on resubmission (admin re-opens during next review if still bad)
  UPDATE public.title_review_issues
     SET status = 'resolved', resolved_at = now(),
         resolution_note = COALESCE('Creator resubmitted: ' || _note, 'Creator resubmitted'),
         updated_at = now()
   WHERE title_id = _title_id AND status = 'open';

  -- Move the title back to the originating stage without admin role check.
  UPDATE public.content_titles
     SET previous_status = status,
         status = target::public.content_status,
         updated_at = now(),
         requested_from_stage = NULL
   WHERE id = _title_id;

  INSERT INTO public.content_approvals(title_id, from_status, to_status, action, note, actor_user_id, created_at)
  VALUES (_title_id, 'changes_requested'::public.content_status, target::public.content_status,
          'creator_resubmit', _note, uid, now());

  INSERT INTO public.notifications(user_id, kind, title, body, created_at)
  VALUES (t_owner, 'title_status',
          'Resubmitted for review',
          'Your title has been returned to ' || target || ' for review.', now());

  RETURN jsonb_build_object('ok', true, 'returned_to_stage', target);
END $$;
REVOKE ALL ON FUNCTION public.creator_resubmit_title(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creator_resubmit_title(uuid,text) TO authenticated, service_role;

-- 4) Security hardening pass — ensure no anon access and tighten policies.
-- Drop anon grants if any (defensive).
REVOKE ALL ON public.title_review_assignments FROM anon;
REVOKE ALL ON public.title_review_checklist   FROM anon;
REVOKE ALL ON public.title_review_notes       FROM anon;
REVOKE ALL ON public.title_review_issues      FROM anon;

-- Add explicit deny for non-admins on internal notes via a stricter policy (defense-in-depth).
DROP POLICY IF EXISTS "admins manage internal review notes" ON public.title_review_notes;
CREATE POLICY "internal notes admin only select"
  ON public.title_review_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));
CREATE POLICY "internal notes admin only write"
  ON public.title_review_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid()));

-- Lock down execute on internal RPCs — service_role + authenticated admins only (admin check enforced inside SECURITY DEFINER).
REVOKE ALL ON FUNCTION public.add_internal_review_note(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_review_issue(uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_review_issue(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_title_checklist_item(uuid,text,text,text,text,text,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_title_reviewer(uuid,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_title_changes(uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.title_review_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_review_candidates() FROM PUBLIC, anon;

-- creator_review_feedback + creator_resubmit_title remain executable by authenticated (owner check is inside).
REVOKE ALL ON FUNCTION public.creator_review_feedback(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.creator_resubmit_title(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.creator_review_feedback(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.creator_resubmit_title(uuid,text) TO authenticated, service_role;
