
CREATE OR REPLACE FUNCTION public.title_delete_eligibility(_title_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_title content_titles%ROWTYPE;
  v_blockers text[] := ARRAY[]::text[];
  v_reasons text[] := ARRAY[]::text[];
  v_lock_days int := 0;
  v_early_fee numeric := 0;
  v_locked_now boolean := false;
  v_status text;
  v_cnt int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'Please sign in to manage your titles.', 'blockers', to_jsonb(ARRAY['unauthenticated']::text[]));
  END IF;

  SELECT * INTO v_title FROM content_titles WHERE id = _title_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'This title is no longer available.', 'blockers', to_jsonb(ARRAY['not_found']::text[]));
  END IF;
  IF v_title.owner_user_id <> v_uid THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'Only the title owner can delete this title.', 'blockers', to_jsonb(ARRAY['not_owner']::text[]));
  END IF;

  v_status := v_title.status::text;

  -- Published titles cannot be deleted
  IF v_status IN ('published','ready_for_distribution','approved','archived') THEN
    v_blockers := array_append(v_blockers, 'published');
    v_reasons := array_append(v_reasons, 'Published titles cannot be deleted.');
  END IF;

  -- Under review
  IF v_status IN ('submitted','in_review','qc_review','legal_review') THEN
    v_blockers := array_append(v_blockers, 'under_review');
    v_reasons := array_append(v_reasons, 'This title is currently under review.');
  END IF;

  -- Active buyer conversations (commercial_requests.state is enum → cast to text)
  BEGIN
    SELECT count(*) INTO v_cnt FROM commercial_requests
      WHERE title_id = _title_id
        AND coalesce(state::text,'') NOT IN ('rejected','withdrawn','closed','declined','cancelled');
    IF v_cnt > 0 THEN
      v_blockers := array_append(v_blockers, 'buyer_requests');
      v_reasons := array_append(v_reasons, 'This title has active commercial activity.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO admin_audit_log(admin_user_id, action, details)
    VALUES (v_uid, 'title_delete_check_error', jsonb_build_object('step','commercial_requests','title_id',_title_id,'error',SQLERRM));
  END;

  -- Active acquisition requests
  BEGIN
    SELECT count(*) INTO v_cnt FROM acquisition_requests
      WHERE title_id = _title_id
        AND coalesce(status::text,'') NOT IN ('rejected','withdrawn','closed','cancelled');
    IF v_cnt > 0 THEN
      v_blockers := array_append(v_blockers, 'buyer_requests');
      v_reasons := array_append(v_reasons, 'This title has active commercial activity.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO admin_audit_log(admin_user_id, action, details)
    VALUES (v_uid, 'title_delete_check_error', jsonb_build_object('step','acquisition_requests','title_id',_title_id,'error',SQLERRM));
  END;

  -- Active licensing agreements
  BEGIN
    SELECT count(*) INTO v_cnt FROM deal_memos
      WHERE title_id = _title_id
        AND coalesce(status::text,'') NOT IN ('cancelled','void','expired','draft','rejected');
    IF v_cnt > 0 THEN
      v_blockers := array_append(v_blockers, 'agreements');
      v_reasons := array_append(v_reasons, 'This title has active commercial activity.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO admin_audit_log(admin_user_id, action, details)
    VALUES (v_uid, 'title_delete_check_error', jsonb_build_object('step','deal_memos','title_id',_title_id,'error',SQLERRM));
  END;

  -- Pending deliveries
  BEGIN
    SELECT count(*) INTO v_cnt FROM deal_deliveries
      WHERE title_id = _title_id
        AND coalesce(status,'') NOT IN ('cancelled','revoked','failed','not_required','not_started');
    IF v_cnt > 0 THEN
      v_blockers := array_append(v_blockers, 'deliveries');
      v_reasons := array_append(v_reasons, 'This title has active commercial activity.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO admin_audit_log(admin_user_id, action, details)
    VALUES (v_uid, 'title_delete_check_error', jsonb_build_object('step','deal_deliveries','title_id',_title_id,'error',SQLERRM));
  END;

  -- Distribution / rights offers
  BEGIN
    SELECT count(*) INTO v_cnt FROM distribution_program_offers
      WHERE title_id = _title_id
        AND coalesce(status::text,'') NOT IN ('rejected','withdrawn','closed','cancelled','expired','draft');
    IF v_cnt > 0 THEN
      v_blockers := array_append(v_blockers, 'agreements');
      v_reasons := array_append(v_reasons, 'This title has active commercial activity.');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO admin_audit_log(admin_user_id, action, details)
    VALUES (v_uid, 'title_delete_check_error', jsonb_build_object('step','distribution_program_offers','title_id',_title_id,'error',SQLERRM));
  END;

  -- Deduplicate reasons
  SELECT array_agg(DISTINCT r) INTO v_reasons FROM unnest(v_reasons) r;

  RETURN jsonb_build_object(
    'allow', array_length(v_blockers,1) IS NULL,
    'reason', CASE WHEN array_length(v_blockers,1) IS NULL
                   THEN 'This title can be removed.'
                   ELSE array_to_string(v_reasons, E'\n') END,
    'blockers', to_jsonb(coalesce(v_blockers, ARRAY[]::text[])),
    'lock_days_remaining', v_lock_days,
    'lock_active', v_locked_now,
    'early_termination_fee_inr', v_early_fee,
    'status', v_status
  );
END;
$function$;
