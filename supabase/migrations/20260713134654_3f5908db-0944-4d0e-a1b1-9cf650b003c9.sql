
-- 1) creator_free_tier_status: expose active/draft/total + caps
CREATE OR REPLACE FUNCTION public.creator_free_tier_status(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_free boolean;
  v_drafts int;
  v_active int;
  v_total int;
  draft_states  text[] := ARRAY['draft','incomplete','changes_requested','rejected'];
  active_states text[] := ARRAY['submitted','in_review','qc_review','legal_review',
                                'approved','ready_for_distribution','published','hold','archived'];
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object(
      'is_free', false,
      'draft_count', 0, 'active_count', 0, 'total_count', 0,
      'lifecycle_count', 0,
      'max_drafts', NULL, 'max_active', NULL, 'max_total', NULL, 'max_submissions', NULL,
      'can_create_draft', false, 'can_submit', false, 'over_limit', false
    );
  END IF;

  v_free := public.is_free_tier_user(_user_id);

  SELECT
    COUNT(*) FILTER (WHERE status::text = ANY(draft_states)),
    COUNT(*) FILTER (WHERE status::text = ANY(active_states)),
    COUNT(*)
  INTO v_drafts, v_active, v_total
  FROM public.content_titles
  WHERE owner_user_id = _user_id;

  RETURN jsonb_build_object(
    'is_free',           v_free,
    'draft_count',       v_drafts,
    'active_count',      v_active,
    'total_count',       v_total,
    -- backward compat for older clients
    'lifecycle_count',   v_active,
    'max_drafts',        CASE WHEN v_free THEN 1 ELSE NULL END,
    'max_active',        CASE WHEN v_free THEN 1 ELSE NULL END,
    'max_total',         CASE WHEN v_free THEN 2 ELSE NULL END,
    'max_submissions',   CASE WHEN v_free THEN 1 ELSE NULL END,
    'can_create_draft',  NOT v_free OR (v_drafts < 1 AND v_total < 2),
    'can_submit',        NOT v_free OR v_active < 1,
    'over_limit',        v_free AND (v_drafts > 1 OR v_active > 1 OR v_total > 2)
  );
END;
$fn$;

-- 2) Enforcement trigger: draft + total on INSERT, active on UPDATE. Existing rows are grandfathered.
CREATE OR REPLACE FUNCTION public.enforce_free_tier_title_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_free boolean;
  v_drafts int;
  v_active int;
  v_total  int;
  draft_states  text[] := ARRAY['draft','incomplete','changes_requested','rejected'];
  active_states text[] := ARRAY['submitted','in_review','qc_review','legal_review',
                                'approved','ready_for_distribution','published','hold','archived'];
BEGIN
  IF public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_free := public.is_free_tier_user(NEW.owner_user_id);
  IF NOT v_free THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT
      COUNT(*) FILTER (WHERE status::text = ANY(draft_states)),
      COUNT(*)
    INTO v_drafts, v_total
    FROM public.content_titles
    WHERE owner_user_id = NEW.owner_user_id;

    IF NEW.status::text = ANY(draft_states) AND v_drafts >= 1 THEN
      RAISE EXCEPTION 'draft_limit_reached: Free plan includes 1 draft. Complete, submit or delete your existing draft to add another.'
        USING ERRCODE = '42501';
    END IF;

    IF v_total >= 2 THEN
      RAISE EXCEPTION 'title_quota_reached: Free plan includes up to 2 titles. Upgrade to add more.'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  -- UPDATE: transition into active states
  IF TG_OP = 'UPDATE'
     AND NEW.status::text = ANY(active_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(active_states))) THEN
    SELECT COUNT(*) INTO v_active
    FROM public.content_titles
    WHERE owner_user_id = NEW.owner_user_id
      AND id <> NEW.id
      AND status::text = ANY(active_states);
    IF v_active >= 1 THEN
      RAISE EXCEPTION 'active_title_limit_reached: Free plan includes 1 active title. Upgrade to submit more titles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

-- 3) delete_creator_title: attach structured error code for the client
CREATE OR REPLACE FUNCTION public.delete_creator_title(_title_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_title content_titles%ROWTYPE;
  v_elig jsonb;
  v_title_name text;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unauthenticated',
                              'message', 'Please sign in to manage your titles.');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_title FROM content_titles WHERE id = _title_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found',
                              'message', 'This title is no longer available.');
  END IF;

  IF v_title.owner_user_id <> v_uid THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_title.owner_user_id, NULL, 'creator_title_delete_denied',
            jsonb_build_object('title_id', _title_id, 'reason', 'not_owner'));
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden',
                              'message', 'Only the title owner can delete this title.');
  END IF;

  v_title_name := v_title.title;
  v_elig := public.title_delete_eligibility(_title_id);

  IF NOT (v_elig->>'allow')::boolean THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_delete_blocked',
            jsonb_build_object(
              'title_id', _title_id, 'title_name', v_title_name,
              'result','blocked','reason',_reason,'eligibility',v_elig
            ));
    RETURN jsonb_build_object('ok', false, 'code', 'protected_title',
                              'message', v_elig->>'reason',
                              'eligibility', v_elig);
  END IF;

  BEGIN
    DELETE FROM content_titles WHERE id = _title_id AND owner_user_id = v_uid;
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_delete_fk_block',
            jsonb_build_object('title_id', _title_id, 'title_name', v_title_name,
                               'sqlerrm', SQLERRM));
    RETURN jsonb_build_object('ok', false, 'code', 'dependency_exists',
                              'message', 'This title has protected records attached and cannot be removed. Contact support to archive it.');
  END;

  INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
  VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_deleted',
          jsonb_build_object('title_id', _title_id, 'title_name', v_title_name,
                             'result','deleted','reason',_reason,
                             'prior_status', v_title.status::text));

  INSERT INTO notifications(user_id, title, message)
  VALUES (v_uid,
          'Title removed — ' || v_title_name,
          'Draft removed successfully. You can now create another draft.');

  FOR v_admin IN SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO notifications(user_id, title, message)
    VALUES (v_admin.user_id, 'Creator removed a title',
            coalesce(v_email,'A creator') || ' removed "' || v_title_name || '".');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'code', 'deleted',
                            'message', 'Draft removed successfully. You can now create another draft.');
END;
$fn$;
