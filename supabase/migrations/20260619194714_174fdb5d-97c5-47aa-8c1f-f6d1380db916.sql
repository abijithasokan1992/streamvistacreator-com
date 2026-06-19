
-- 1) Extend content_status enum (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'content_status' AND e.enumlabel = 'ready_for_distribution'
  ) THEN
    ALTER TYPE public.content_status ADD VALUE 'ready_for_distribution' AFTER 'approved';
  END IF;
END$$;

-- 2) Extend transition matrix (additive — preserves all existing transitions)
CREATE OR REPLACE FUNCTION public.transition_title_status(_title_id uuid, _to_status text, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

  IF t_status = 'submitted'    AND new_status IN ('in_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'in_review'    AND new_status IN ('qc_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'qc_review'    AND new_status IN ('legal_review','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'legal_review' AND new_status IN ('approved','changes_requested','hold','rejected') THEN allowed := true;
  ELSIF t_status = 'approved'     AND new_status IN ('ready_for_distribution','published','hold') THEN allowed := true;
  ELSIF t_status = 'ready_for_distribution' AND new_status IN ('published','hold','archived') THEN allowed := true;
  ELSIF t_status = 'published'    AND new_status IN ('archived','hold') THEN allowed := true;
  ELSIF t_status = 'hold'         AND new_status NOT IN ('hold') THEN allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Illegal transition: % → %', t_status, new_status USING ERRCODE = '22023';
  END IF;

  IF new_status = 'changes_requested' THEN
    new_locked := false;
  ELSIF new_status IN ('archived') THEN
    new_locked := t_locked;
  ELSE
    new_locked := true;
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
    WHEN 'ready_for_distribution' THEN 'title_ready_for_distribution'
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

-- 3) Notification + email trigger on content_approvals insert
CREATE OR REPLACE FUNCTION public.notify_on_content_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  t_owner uuid;
  t_title text;
  owner_email text;
  notif_title text;
  notif_msg text;
  to_status_label text;
  base text := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/send-transactional-email';
  idem text;
BEGIN
  SELECT owner_user_id, title INTO t_owner, t_title
  FROM public.content_titles WHERE id = NEW.title_id;
  IF t_owner IS NULL THEN RETURN NEW; END IF;

  SELECT email INTO owner_email FROM auth.users WHERE id = t_owner;

  to_status_label := CASE NEW.to_status::text
    WHEN 'submitted' THEN 'Submitted for review'
    WHEN 'in_review' THEN 'Review started'
    WHEN 'qc_review' THEN 'QC review started'
    WHEN 'legal_review' THEN 'Legal review started'
    WHEN 'approved' THEN 'Approved'
    WHEN 'ready_for_distribution' THEN 'Ready for distribution'
    WHEN 'published' THEN 'Published'
    WHEN 'changes_requested' THEN 'Changes requested'
    WHEN 'rejected' THEN 'Rejected'
    WHEN 'hold' THEN 'On hold'
    WHEN 'archived' THEN 'Archived'
    ELSE replace(NEW.to_status::text,'_',' ')
  END;

  notif_title := t_title || ' — ' || to_status_label;
  notif_msg := COALESCE(NEW.note,
    CASE NEW.to_status::text
      WHEN 'in_review' THEN 'Your title has been picked up by the review team.'
      WHEN 'qc_review' THEN 'Your title is now in Quality Control review.'
      WHEN 'legal_review' THEN 'Your title is now in Legal review.'
      WHEN 'approved' THEN 'Your title has been approved.'
      WHEN 'ready_for_distribution' THEN 'Your title is ready for distribution.'
      WHEN 'published' THEN 'Your title has been published.'
      WHEN 'changes_requested' THEN 'The review team has requested changes.'
      WHEN 'rejected' THEN 'Your title was not approved.'
      WHEN 'hold' THEN 'Your title has been placed on hold.'
      WHEN 'submitted' THEN 'Your title has been submitted for review.'
      ELSE 'Status updated to ' || to_status_label || '.'
    END);

  INSERT INTO public.notifications (user_id, title, message, is_read)
  VALUES (t_owner, notif_title, notif_msg, false);

  IF owner_email IS NOT NULL THEN
    idem := 'title-status-' || NEW.id::text;
    PERFORM net.http_post(
      url := base,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'templateName','title-status-update',
        'recipientEmail', owner_email,
        'idempotencyKey', idem,
        'templateData', jsonb_build_object(
          'titleName', t_title,
          'toStatus', NEW.to_status::text,
          'toStatusLabel', to_status_label,
          'fromStatus', NEW.from_status::text,
          'note', NEW.note,
          'occurredAt', NEW.created_at
        )
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the transition on notification failures
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notify_on_content_approval ON public.content_approvals;
CREATE TRIGGER trg_notify_on_content_approval
AFTER INSERT ON public.content_approvals
FOR EACH ROW EXECUTE FUNCTION public.notify_on_content_approval();
