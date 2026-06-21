
-- 1. review_comments: scoped read policy
CREATE POLICY "Authors and reviewers can read review comments"
ON public.review_comments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.review_links rl
    WHERE rl.id = review_comments.review_link_id
      AND (
        rl.created_by = auth.uid()
        OR (rl.workspace_id IS NOT NULL AND public.is_workspace_member(rl.workspace_id, auth.uid()))
      )
  )
);

-- 2. Realtime: restrictive policy requiring ws:<uuid> topic for non-admin reads
CREATE POLICY "realtime_require_ws_topic_for_non_admin"
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.realtime_topic_workspace((SELECT realtime.topic())) IS NOT NULL
);

-- 3. site_config: audit Oracle infra changes
CREATE OR REPLACE FUNCTION public.audit_site_config_oracle_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email text;
  changed jsonb := '{}'::jsonb;
BEGIN
  SELECT email INTO actor_email FROM auth.users WHERE id = auth.uid();
  IF NEW.oracle_tenancy_ocid IS DISTINCT FROM OLD.oracle_tenancy_ocid THEN
    changed := changed || jsonb_build_object('oracle_tenancy_ocid', jsonb_build_object('old', OLD.oracle_tenancy_ocid, 'new', NEW.oracle_tenancy_ocid));
  END IF;
  IF NEW.oracle_user_ocid IS DISTINCT FROM OLD.oracle_user_ocid THEN
    changed := changed || jsonb_build_object('oracle_user_ocid', jsonb_build_object('old', OLD.oracle_user_ocid, 'new', NEW.oracle_user_ocid));
  END IF;
  IF NEW.oracle_fingerprint IS DISTINCT FROM OLD.oracle_fingerprint THEN
    changed := changed || jsonb_build_object('oracle_fingerprint', jsonb_build_object('old', OLD.oracle_fingerprint, 'new', NEW.oracle_fingerprint));
  END IF;
  IF NEW.oracle_region IS DISTINCT FROM OLD.oracle_region THEN
    changed := changed || jsonb_build_object('oracle_region', jsonb_build_object('old', OLD.oracle_region, 'new', NEW.oracle_region));
  END IF;
  IF NEW.oracle_namespace IS DISTINCT FROM OLD.oracle_namespace THEN
    changed := changed || jsonb_build_object('oracle_namespace', jsonb_build_object('old', OLD.oracle_namespace, 'new', NEW.oracle_namespace));
  END IF;
  IF NEW.oracle_bucket IS DISTINCT FROM OLD.oracle_bucket THEN
    changed := changed || jsonb_build_object('oracle_bucket', jsonb_build_object('old', OLD.oracle_bucket, 'new', NEW.oracle_bucket));
  END IF;
  IF NEW.oracle_private_key_set IS DISTINCT FROM OLD.oracle_private_key_set THEN
    changed := changed || jsonb_build_object('oracle_private_key_set', jsonb_build_object('old', OLD.oracle_private_key_set, 'new', NEW.oracle_private_key_set));
  END IF;

  IF changed <> '{}'::jsonb THEN
    INSERT INTO public.admin_audit_log (admin_user_id, admin_email, action, details)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      actor_email,
      'site_config.oracle_update',
      changed
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_site_config_oracle ON public.site_config;
CREATE TRIGGER trg_audit_site_config_oracle
AFTER UPDATE ON public.site_config
FOR EACH ROW
EXECUTE FUNCTION public.audit_site_config_oracle_changes();
