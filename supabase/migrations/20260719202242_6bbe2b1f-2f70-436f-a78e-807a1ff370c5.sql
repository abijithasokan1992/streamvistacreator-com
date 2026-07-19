CREATE OR REPLACE FUNCTION public.submit_title_to_admin(_title_id uuid, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t_owner uuid;
  t_status public.content_status;
  t_workspace uuid;
  readiness jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Row-lock the title for the duration of this transaction so that a
  -- second concurrent submit attempt (double-click, rapid retry) blocks
  -- here and then sees the already-transitioned status below, rather
  -- than racing past the status check and double-inserting approval /
  -- audit-log rows.
  SELECT owner_user_id, status, workspace_id
    INTO t_owner, t_status, t_workspace
  FROM public.content_titles
   WHERE id = _title_id
   FOR UPDATE;

  IF t_owner IS NULL THEN
    RAISE EXCEPTION 'Title not found' USING ERRCODE = 'P0002';
  END IF;
  IF t_owner <> uid AND NOT public.has_role(uid,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF t_status NOT IN ('draft','incomplete','changes_requested') THEN
    RAISE EXCEPTION 'Only drafts can be submitted (current: %)', t_status USING ERRCODE = '22023';
  END IF;

  readiness := public.title_submission_readiness(_title_id);
  IF (readiness->>'ready')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Title not ready for submission: %', readiness->>'missing' USING ERRCODE = '22023';
  END IF;

  UPDATE public.content_titles
     SET status       = 'submitted',
         submitted_at = now(),
         locked       = true,
         locked_at    = now(),
         locked_by    = uid,
         updated_at   = now()
   WHERE id = _title_id;

  INSERT INTO public.content_approvals (title_id, actor_user_id, from_status, to_status, note)
  VALUES (_title_id, uid, t_status, 'submitted', _note);

  INSERT INTO public.admin_audit_log (
    admin_user_id, admin_email, target_user_id, target_email, action, details
  )
  VALUES (
    uid,
    (SELECT email FROM auth.users WHERE id = uid),
    t_owner,
    (SELECT email FROM auth.users WHERE id = t_owner),
    'title_submitted',
    jsonb_build_object(
      'actor_user_id', uid,
      'organization_id', t_workspace,
      'title_id', _title_id,
      'from_status', t_status,
      'to_status', 'submitted',
      'created_at', now()
    )
  );
END;
$function$;