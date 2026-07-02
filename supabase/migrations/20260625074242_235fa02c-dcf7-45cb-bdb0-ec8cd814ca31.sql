
-- ============================================================
-- Studio profile audit log
-- ============================================================

CREATE TABLE IF NOT EXISTS public.entity_profile_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.entity_profiles(id) ON DELETE CASCADE,
  org_id        uuid,
  kind          text NOT NULL,
  source_table  text NOT NULL,          -- 'entity_profiles' | 'entity_profile_studio_ext'
  actor_id      uuid,                   -- auth.uid() at the time of change
  actor_role    text,                   -- jwt role / app role hint
  action        text NOT NULL,          -- 'update'
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_values    jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_audit_profile  ON public.entity_profile_audit_log(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_audit_org      ON public.entity_profile_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_audit_actor    ON public.entity_profile_audit_log(actor_id, created_at DESC);

GRANT SELECT ON public.entity_profile_audit_log TO authenticated;
GRANT ALL    ON public.entity_profile_audit_log TO service_role;

ALTER TABLE public.entity_profile_audit_log ENABLE ROW LEVEL SECURITY;

-- Read: workspace owners/admins for the org, the creator (for kind='creator'),
--       and platform admins. No insert/update/delete from the API — trigger writes.
CREATE POLICY "view entity audit"
ON public.entity_profile_audit_log
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
  OR (kind = 'creator' AND EXISTS (
       SELECT 1 FROM public.entity_profiles p
       WHERE p.id = profile_id AND p.user_id = auth.uid()
     ))
  OR (org_id IS NOT NULL AND public.is_workspace_admin(org_id, auth.uid()))
);

-- ============================================================
-- Trigger: log sensitive changes on entity_profiles
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_entity_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fields     text[] := '{}';
  v_old        jsonb  := '{}'::jsonb;
  v_new        jsonb  := '{}'::jsonb;
  v_actor      uuid   := auth.uid();
  v_actor_role text   := current_setting('request.jwt.claim.role', true);
  v_col        text;
  v_cols       text[] := ARRAY[
    'legal_name','display_name','entity_type',
    'primary_email','primary_phone','whatsapp','website',
    'address_line1','address_line2','city','state','postal_code','country',
    'pan_number','gstin','tan_number','cin_number',
    'is_gst_registered','place_of_supply_state',
    'billing_legal_name','billing_email','billing_phone',
    'billing_address_line1','billing_address_line2',
    'billing_city','billing_state','billing_postal_code','billing_country','billing_notes'
  ];
  v_old_row jsonb := to_jsonb(OLD);
  v_new_row jsonb := to_jsonb(NEW);
BEGIN
  FOREACH v_col IN ARRAY v_cols LOOP
    IF (v_old_row -> v_col) IS DISTINCT FROM (v_new_row -> v_col) THEN
      v_fields := array_append(v_fields, v_col);
      v_old := v_old || jsonb_build_object(v_col, v_old_row -> v_col);
      v_new := v_new || jsonb_build_object(v_col, v_new_row -> v_col);
    END IF;
  END LOOP;

  IF array_length(v_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.entity_profile_audit_log
    (profile_id, org_id, kind, source_table, actor_id, actor_role,
     action, changed_fields, old_values, new_values)
  VALUES
    (NEW.id, NEW.org_id, NEW.kind, 'entity_profiles', v_actor, v_actor_role,
     'update', v_fields, v_old, v_new);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_entity_profile_changes ON public.entity_profiles;
CREATE TRIGGER trg_log_entity_profile_changes
AFTER UPDATE ON public.entity_profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_entity_profile_changes();

-- ============================================================
-- Trigger: log sensitive changes on entity_profile_studio_ext
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_studio_ext_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_fields     text[] := '{}';
  v_old        jsonb  := '{}'::jsonb;
  v_new        jsonb  := '{}'::jsonb;
  v_actor      uuid   := auth.uid();
  v_actor_role text   := current_setting('request.jwt.claim.role', true);
  v_col        text;
  v_cols       text[] := ARRAY[
    'about','services','facility_capabilities',
    'languages_served','regions_served',
    'primary_contact_name','primary_contact_designation',
    'primary_contact_email','primary_contact_phone',
    'year_founded'
  ];
  v_old_row jsonb := to_jsonb(OLD);
  v_new_row jsonb := to_jsonb(NEW);
  v_org_id  uuid;
  v_kind    text;
BEGIN
  FOREACH v_col IN ARRAY v_cols LOOP
    IF (v_old_row -> v_col) IS DISTINCT FROM (v_new_row -> v_col) THEN
      v_fields := array_append(v_fields, v_col);
      v_old := v_old || jsonb_build_object(v_col, v_old_row -> v_col);
      v_new := v_new || jsonb_build_object(v_col, v_new_row -> v_col);
    END IF;
  END LOOP;

  IF array_length(v_fields, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT org_id, kind INTO v_org_id, v_kind
  FROM public.entity_profiles
  WHERE id = NEW.profile_id;

  INSERT INTO public.entity_profile_audit_log
    (profile_id, org_id, kind, source_table, actor_id, actor_role,
     action, changed_fields, old_values, new_values)
  VALUES
    (NEW.profile_id, v_org_id, COALESCE(v_kind, 'studio'),
     'entity_profile_studio_ext', v_actor, v_actor_role,
     'update', v_fields, v_old, v_new);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_studio_ext_changes ON public.entity_profile_studio_ext;
CREATE TRIGGER trg_log_studio_ext_changes
AFTER UPDATE ON public.entity_profile_studio_ext
FOR EACH ROW
EXECUTE FUNCTION public.log_studio_ext_changes();
