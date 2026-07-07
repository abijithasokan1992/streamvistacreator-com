
-- Eligibility check: returns friendly JSON with allow/reason/blockers/lock info.
CREATE OR REPLACE FUNCTION public.title_delete_eligibility(_title_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_title content_titles%ROWTYPE;
  v_blockers text[] := ARRAY[]::text[];
  v_reasons text[] := ARRAY[]::text[];
  v_lock_days int := 0;
  v_early_fee numeric := 0;
  v_locked_now boolean := false;
  v_locked_at timestamptz;
  v_status text;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'Please sign in to manage your titles.');
  END IF;

  SELECT * INTO v_title FROM content_titles WHERE id = _title_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'This title is no longer available.');
  END IF;
  IF v_title.owner_user_id <> v_uid THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'Only the title owner can delete this title.');
  END IF;

  v_status := v_title.status::text;

  -- Status gate: only Draft-family or In-Review may be deleted.
  IF v_status NOT IN ('draft','incomplete','changes_requested','submitted','in_review','qc_review','legal_review','hold','rejected') THEN
    v_blockers := array_append(v_blockers, 'approved_or_published');
    v_reasons := array_append(v_reasons,
      'This title has moved past review and cannot be removed directly. Please contact support to withdraw it.');
  END IF;

  -- Buyer requests / negotiations
  SELECT count(*) INTO v_cnt FROM commercial_requests
    WHERE title_id = _title_id
      AND coalesce(state,'') NOT IN ('rejected','withdrawn','closed','declined','cancelled');
  IF v_cnt > 0 THEN
    v_blockers := array_append(v_blockers, 'buyer_requests');
    v_reasons := array_append(v_reasons,
      'Buyers are actively engaged on this title. Please close or withdraw those conversations first.');
  END IF;

  SELECT count(*) INTO v_cnt FROM acquisition_requests
    WHERE title_id = _title_id
      AND coalesce(status,'') NOT IN ('rejected','withdrawn','closed','cancelled');
  IF v_cnt > 0 THEN
    v_blockers := array_append(v_blockers, 'acquisition_requests');
    v_reasons := array_append(v_reasons,
      'There are open acquisition requests on this title.');
  END IF;

  -- Deal memos / agreements
  SELECT count(*) INTO v_cnt FROM deal_memos
    WHERE title_id = _title_id
      AND coalesce(status::text,'') NOT IN ('cancelled','void','expired');
  IF v_cnt > 0 THEN
    v_blockers := array_append(v_blockers, 'agreements');
    v_reasons := array_append(v_reasons,
      'A licensing agreement is in progress for this title.');
  END IF;

  -- Deliveries
  SELECT count(*) INTO v_cnt FROM deal_deliveries
    WHERE title_id = _title_id
      AND coalesce(status,'') NOT IN ('cancelled','revoked','failed');
  IF v_cnt > 0 THEN
    v_blockers := array_append(v_blockers, 'deliveries');
    v_reasons := array_append(v_reasons,
      'This title has active or pending deliveries.');
  END IF;

  -- Distribution / rights offers
  SELECT count(*) INTO v_cnt FROM distribution_program_offers
    WHERE title_id = _title_id
      AND coalesce(status,'') NOT IN ('rejected','withdrawn','closed','cancelled','expired');
  IF v_cnt > 0 THEN
    v_blockers := array_append(v_blockers, 'rights_commitments');
    v_reasons := array_append(v_reasons,
      'Rights commitments are in place for this title.');
  END IF;

  -- Contractual lock period (soft): if metadata carries a lock_until date.
  IF v_title.metadata ? 'lock_until' THEN
    BEGIN
      v_lock_days := GREATEST(0, ((v_title.metadata->>'lock_until')::timestamptz::date - CURRENT_DATE));
      IF v_lock_days > 0 THEN
        v_locked_now := true;
        v_early_fee := 25000; -- ₹25,000 + GST early termination fee
        v_blockers := array_append(v_blockers, 'lock_period');
        v_reasons := array_append(v_reasons,
          format('A contractual lock period is in effect for %s more day(s). Early termination fee ₹25,000 + GST applies.', v_lock_days));
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'allow', array_length(v_blockers,1) IS NULL,
    'reason', CASE WHEN array_length(v_blockers,1) IS NULL
                   THEN 'This title can be removed.'
                   ELSE array_to_string(v_reasons, E'\n') END,
    'blockers', to_jsonb(v_blockers),
    'lock_days_remaining', v_lock_days,
    'lock_active', v_locked_now,
    'early_termination_fee_inr', v_early_fee,
    'status', v_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.title_delete_eligibility(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.title_delete_eligibility(uuid) TO authenticated;

-- Delete action: enforces ownership + eligibility, audits + notifies.
CREATE OR REPLACE FUNCTION public.delete_creator_title(_title_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_title content_titles%ROWTYPE;
  v_elig jsonb;
  v_title_name text;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Please sign in to manage your titles.');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT * INTO v_title FROM content_titles WHERE id = _title_id;

  IF NOT FOUND THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_delete_missing',
            jsonb_build_object('title_id', _title_id, 'result', 'not_found', 'reason', _reason));
    RETURN jsonb_build_object('ok', false, 'message', 'This title is no longer available.');
  END IF;

  IF v_title.owner_user_id <> v_uid THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_title.owner_user_id, NULL, 'creator_title_delete_denied',
            jsonb_build_object('title_id', _title_id, 'reason', 'not_owner'));
    RETURN jsonb_build_object('ok', false, 'message', 'Only the title owner can delete this title.');
  END IF;

  v_title_name := v_title.title;
  v_elig := public.title_delete_eligibility(_title_id);

  IF NOT (v_elig->>'allow')::boolean THEN
    INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
    VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_delete_blocked',
            jsonb_build_object(
              'title_id', _title_id,
              'title_name', v_title_name,
              'result', 'blocked',
              'reason', _reason,
              'eligibility', v_elig,
              'payment_status', 'not_applicable'
            ));

    INSERT INTO notifications(user_id, title, message)
    VALUES (v_uid,
            'Delete blocked — ' || v_title_name,
            coalesce(v_elig->>'reason','This title cannot be removed right now.'));

    RETURN jsonb_build_object('ok', false, 'message', v_elig->>'reason', 'eligibility', v_elig);
  END IF;

  -- Perform the delete (FKs handle assets/approvals/lock_state via CASCADE).
  DELETE FROM content_titles WHERE id = _title_id AND owner_user_id = v_uid;

  INSERT INTO admin_audit_log(admin_user_id, admin_email, target_user_id, target_email, action, details)
  VALUES (v_uid, v_email, v_uid, v_email, 'creator_title_deleted',
          jsonb_build_object(
            'title_id', _title_id,
            'title_name', v_title_name,
            'result', 'deleted',
            'reason', _reason,
            'payment_status', 'not_applicable',
            'prior_status', v_title.status::text
          ));

  -- Notify the creator (in-app).
  INSERT INTO notifications(user_id, title, message)
  VALUES (v_uid,
          'Title removed — ' || v_title_name,
          'Your title "' || v_title_name || '" has been removed from your workspace.');

  -- Notify platform admins (dashboard feed).
  FOR v_admin IN
    SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'admin'::app_role
  LOOP
    INSERT INTO notifications(user_id, title, message)
    VALUES (v_admin.user_id,
            'Creator removed a title',
            coalesce(v_email,'A creator') || ' removed "' || v_title_name || '".');
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'message', 'Title removed successfully.');
END;
$$;

REVOKE ALL ON FUNCTION public.delete_creator_title(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_creator_title(uuid, text) TO authenticated;
