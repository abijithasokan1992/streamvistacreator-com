
-- Stream 8: admin storage grant RPC + abandoned topup sweep RPC

CREATE OR REPLACE FUNCTION public.admin_grant_storage(
  _user_id uuid,
  _gb integer,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  actor_email text;
  alloc_id uuid;
  target_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT (public.has_role(uid,'admin'::public.app_role) OR public.is_super_admin(uid)) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF _user_id IS NULL OR _gb IS NULL OR _gb <= 0 THEN
    RAISE EXCEPTION 'Invalid input' USING ERRCODE='22023';
  END IF;

  SELECT email INTO actor_email FROM auth.users WHERE id = uid;
  SELECT email INTO target_email FROM auth.users WHERE id = _user_id;

  SELECT id INTO alloc_id FROM public.storage_allocations
    WHERE user_id = _user_id AND source = 'admin_grant'
    ORDER BY created_at ASC LIMIT 1;

  IF alloc_id IS NULL THEN
    INSERT INTO public.storage_allocations (user_id, allocated_gb, used_gb, source, granted_by, notes)
    VALUES (_user_id, _gb, 0, 'admin_grant', uid, COALESCE(_note,'admin grant'))
    RETURNING id INTO alloc_id;
  ELSE
    UPDATE public.storage_allocations
       SET allocated_gb = allocated_gb + _gb,
           granted_by = uid,
           notes = COALESCE(_note, notes),
           updated_at = now()
     WHERE id = alloc_id;
  END IF;

  INSERT INTO public.admin_audit_log (admin_user_id, admin_email, target_user_id, target_email, action, details)
  VALUES (uid, actor_email, _user_id, target_email, 'storage_grant',
    jsonb_build_object('allocation_id', alloc_id, 'gb_added', _gb, 'note', _note, 'created_at', now()));

  RETURN jsonb_build_object('ok', true, 'allocation_id', alloc_id, 'gb_added', _gb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_storage(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_storage(uuid,integer,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sweep_abandoned_topups(_older_than_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  affected int := 0;
  r RECORD;
BEGIN
  -- Only admin / service role may run; service role bypass via security definer for cron callers
  IF auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(),'admin'::public.app_role) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;

  FOR r IN
    SELECT id, user_id, razorpay_order_id, created_at
      FROM public.storage_topups
     WHERE status = 'pending'
       AND created_at < (now() - make_interval(hours => GREATEST(1,_older_than_hours)))
     FOR UPDATE
  LOOP
    UPDATE public.storage_topups
       SET status = 'abandoned',
           notes  = COALESCE(notes,'') ||
                    CASE WHEN COALESCE(notes,'') = '' THEN '' ELSE E'\n' END ||
                    'auto-marked abandoned at '||to_char(now(),'YYYY-MM-DD HH24:MI:SSOF'),
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.payment_debug_logs (severity, action_type, source, user_id, order_id, error_message, extra)
    VALUES ('WARN','topup.abandoned','sweep', r.user_id, r.razorpay_order_id,
            'Top-up pending for more than '||_older_than_hours||'h',
            jsonb_build_object('topup_id', r.id, 'created_at', r.created_at));

    affected := affected + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'abandoned', affected, 'older_than_hours', _older_than_hours);
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_abandoned_topups(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sweep_abandoned_topups(integer) TO authenticated, service_role;

-- Extend payment_security_events view so abandoned topups appear with a category
CREATE OR REPLACE VIEW public.payment_security_events AS
SELECT id, created_at, severity, action_type, source, user_id, order_id, payment_id,
       event_id, error_message, duration_ms, extra,
       CASE
         WHEN action_type = 'webhook.signature' AND severity = 'ERROR' THEN 'invalid_signature'
         WHEN action_type = 'webhook.replay_skipped' THEN 'duplicate_event'
         WHEN action_type = 'webhook.replay_attempt' THEN 'replay_attempt'
         WHEN action_type = 'webhook.idempotency_conflict' THEN 'idempotency_conflict'
         WHEN action_type = 'entitlement.projection_failed' THEN 'entitlement_projection_failure'
         WHEN action_type = 'subscription.mapping_failed' THEN 'subscription_mapping_failure'
         WHEN action_type = 'invoice.mismatch' THEN 'invoice_mismatch'
         WHEN action_type = 'payment.amount_mismatch' THEN 'amount_mismatch'
         WHEN action_type = 'webhook.parse_failed' THEN 'webhook_parse_failure'
         WHEN action_type = 'payment.unknown_mapping' THEN 'unknown_payment_mapping'
         WHEN action_type = 'topup.abandoned' THEN 'topup_abandoned'
         ELSE NULL
       END AS event_category
FROM public.payment_debug_logs;
