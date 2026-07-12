
-- 1) Editability helper
CREATE OR REPLACE FUNCTION public.is_title_editable_by_creator(_title_id uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.content_titles t
    WHERE t.id = _title_id
      AND t.owner_user_id = _user
      AND t.locked = false
      AND t.status IN ('draft'::content_status,
                       'rejected'::content_status,
                       'changes_requested'::content_status)
  );
$$;

REVOKE ALL ON FUNCTION public.is_title_editable_by_creator(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_title_editable_by_creator(uuid, uuid) TO authenticated, service_role;

-- 2) Auto-lock trigger + admin-only unlock guard
CREATE OR REPLACE FUNCTION public.enforce_title_lock_from_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('submitted'::content_status,
                    'in_review'::content_status,
                    'qc_review'::content_status,
                    'legal_review'::content_status,
                    'approved'::content_status,
                    'ready_for_distribution'::content_status,
                    'published'::content_status,
                    'locked'::content_status)
  THEN
    NEW.locked := true;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.locked, false) = true
     AND COALESCE(NEW.locked, false) = false
     AND NOT (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.is_super_admin(auth.uid()))
  THEN
    NEW.locked := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_title_lock ON public.content_titles;
CREATE TRIGGER trg_enforce_title_lock
  BEFORE INSERT OR UPDATE OF status, locked
  ON public.content_titles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_title_lock_from_status();

-- 3) title_media_versions
DROP POLICY IF EXISTS tmv_owner_all ON public.title_media_versions;
CREATE POLICY tmv_owner_select ON public.title_media_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t
                 WHERE t.id = title_media_versions.title_id AND t.owner_user_id = auth.uid()));
CREATE POLICY tmv_owner_insert ON public.title_media_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tmv_owner_update ON public.title_media_versions FOR UPDATE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()))
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tmv_owner_delete ON public.title_media_versions FOR DELETE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()));

-- 4) title_localizations
DROP POLICY IF EXISTS tl_owner_all ON public.title_localizations;
CREATE POLICY tl_owner_select ON public.title_localizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t
                 WHERE t.id = title_localizations.title_id AND t.owner_user_id = auth.uid()));
CREATE POLICY tl_owner_insert ON public.title_localizations FOR INSERT TO authenticated
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tl_owner_update ON public.title_localizations FOR UPDATE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()))
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tl_owner_delete ON public.title_localizations FOR DELETE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()));

-- 5) title_publishing
DROP POLICY IF EXISTS tp_owner_all ON public.title_publishing;
CREATE POLICY tp_owner_select ON public.title_publishing FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t
                 WHERE t.id = title_publishing.title_id AND t.owner_user_id = auth.uid()));
CREATE POLICY tp_owner_insert ON public.title_publishing FOR INSERT TO authenticated
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tp_owner_update ON public.title_publishing FOR UPDATE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()))
  WITH CHECK (public.is_title_editable_by_creator(title_id, auth.uid()));
CREATE POLICY tp_owner_delete ON public.title_publishing FOR DELETE TO authenticated
  USING (public.is_title_editable_by_creator(title_id, auth.uid()));

-- 6) title_rights_availability — creator-declarable statuses only
DROP POLICY IF EXISTS rights_owner_insert ON public.title_rights_availability;
DROP POLICY IF EXISTS rights_owner_update ON public.title_rights_availability;
DROP POLICY IF EXISTS rights_owner_delete ON public.title_rights_availability;

CREATE POLICY rights_owner_insert ON public.title_rights_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_title_editable_by_creator(title_id, auth.uid())
    AND status IN ('none'::right_status,
                   'available'::right_status,
                   'discuss'::right_status,
                   'premium_required'::right_status)
  );

CREATE POLICY rights_owner_update ON public.title_rights_availability
  FOR UPDATE TO authenticated
  USING (
    public.is_title_editable_by_creator(title_id, auth.uid())
    AND status IN ('none'::right_status,
                   'available'::right_status,
                   'discuss'::right_status,
                   'premium_required'::right_status)
  )
  WITH CHECK (
    public.is_title_editable_by_creator(title_id, auth.uid())
    AND status IN ('none'::right_status,
                   'available'::right_status,
                   'discuss'::right_status,
                   'premium_required'::right_status)
  );

CREATE POLICY rights_owner_delete ON public.title_rights_availability
  FOR DELETE TO authenticated
  USING (
    public.is_title_editable_by_creator(title_id, auth.uid())
    AND status IN ('none'::right_status,
                   'available'::right_status,
                   'discuss'::right_status,
                   'premium_required'::right_status)
  );

-- 7) distribution_queue — Admin-only writes
DROP POLICY IF EXISTS "owner enqueue" ON public.distribution_queue;
DROP POLICY IF EXISTS "owner or admin update queue" ON public.distribution_queue;
DROP POLICY IF EXISTS dq_admin_write ON public.distribution_queue;
CREATE POLICY dq_admin_write ON public.distribution_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.is_super_admin(auth.uid()));

-- 8) distribution_packages — Admin-only writes
DROP POLICY IF EXISTS "owner or admin write packages" ON public.distribution_packages;
DROP POLICY IF EXISTS dp_admin_write ON public.distribution_packages;
CREATE POLICY dp_admin_write ON public.distribution_packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
              OR public.is_super_admin(auth.uid()));
