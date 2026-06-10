
-- Expanded UPDATE trigger: log every changed field (not just status fields)
CREATE OR REPLACE FUNCTION public.log_onboarding_full_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email text;
  col text;
  old_v text;
  new_v text;
BEGIN
  SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'onboarding_requests'
      AND column_name NOT IN ('id','created_at','updated_at')
  LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', col, col)
      INTO old_v, new_v USING OLD, NEW;
    IF old_v IS DISTINCT FROM new_v THEN
      INSERT INTO public.onboarding_audit_log(onboarding_request_id, changed_by, changed_by_email, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), actor_email, col, old_v, new_v);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_status_changes ON public.onboarding_requests;
DROP TRIGGER IF EXISTS trg_onboarding_full_update ON public.onboarding_requests;
CREATE TRIGGER trg_onboarding_full_update
AFTER UPDATE ON public.onboarding_requests
FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_full_update();

-- DELETE trigger
CREATE OR REPLACE FUNCTION public.log_onboarding_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor_email text;
BEGIN
  SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.onboarding_audit_log(onboarding_request_id, changed_by, changed_by_email, field_name, old_value, new_value)
  VALUES (OLD.id, auth.uid(), actor_email, '__deleted__',
          jsonb_strip_nulls(to_jsonb(OLD))::text, NULL);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_delete ON public.onboarding_requests;
CREATE TRIGGER trg_onboarding_delete
BEFORE DELETE ON public.onboarding_requests
FOR EACH ROW EXECUTE FUNCTION public.log_onboarding_delete();

-- View-access logger (called by admin UI when opening a record)
CREATE OR REPLACE FUNCTION public.log_onboarding_request_view(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_email text;
  rid uuid;
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin'::app_role) THEN
    RETURN;
  END IF;
  SELECT email INTO actor_email FROM auth.users WHERE id = actor;
  FOREACH rid IN ARRAY COALESCE(_ids, ARRAY[]::uuid[]) LOOP
    INSERT INTO public.onboarding_audit_log(onboarding_request_id, changed_by, changed_by_email, field_name, old_value, new_value)
    VALUES (rid, actor, actor_email, '__viewed__', NULL, NULL);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_onboarding_request_view(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_onboarding_request_view(uuid[]) TO authenticated;
