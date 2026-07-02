
-- ============================================================
-- Stream 4B Hardening Migration
-- ============================================================

-- PRIORITY 1: Re-assert lock guard triggers (idempotent).
DROP TRIGGER IF EXISTS trg_ct_lock_guard ON public.content_titles;
CREATE TRIGGER trg_ct_lock_guard
  BEFORE UPDATE OR DELETE ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.content_titles_lock_guard();

DROP TRIGGER IF EXISTS title_assets_lock_guard_trg ON public.title_assets;
CREATE TRIGGER title_assets_lock_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.title_assets
  FOR EACH ROW EXECUTE FUNCTION public.title_assets_lock_guard();

-- ============================================================
-- PRIORITY 2: recent_uploads RLS hardening.
--
-- All INSERT / UPDATE / DELETE on recent_uploads happen exclusively
-- via edge functions running under service_role (oci-upload,
-- oci-multipart, admin-asset-manager, admin-users). End-user
-- sessions only ever SELECT. Removing direct client write paths
-- eliminates the object_key / user_id / workspace_id forgery
-- vectors flagged in the Stream 4B Validation Report.
-- ============================================================

DROP POLICY IF EXISTS "Workspace writers insert uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Workspace writers update uploads" ON public.recent_uploads;
DROP POLICY IF EXISTS "Workspace writers delete uploads" ON public.recent_uploads;

-- Defense in depth: also revoke the table-level privileges so even
-- a future permissive policy could not re-open client writes.
REVOKE INSERT, UPDATE, DELETE ON public.recent_uploads FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.recent_uploads FROM anon;
GRANT  ALL ON public.recent_uploads TO service_role;

-- ============================================================
-- Immutability trigger: even service_role edge functions must not
-- silently re-point an existing upload row at a different object,
-- owner, workspace, or size after creation. The legitimate update
-- surface is status / error_message / par_url / par_expires_at /
-- oci_upload_id / updated_at. Anything else on UPDATE is rejected.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recent_uploads_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id      IS DISTINCT FROM OLD.user_id      THEN RAISE EXCEPTION 'recent_uploads.user_id is immutable'      USING ERRCODE = '42501'; END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN RAISE EXCEPTION 'recent_uploads.workspace_id is immutable' USING ERRCODE = '42501'; END IF;
  IF NEW.object_key   IS DISTINCT FROM OLD.object_key   THEN
    -- admin-asset-manager rename flow is the only legitimate rewrite path;
    -- allow it only when the caller is a platform admin.
    IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
      RAISE EXCEPTION 'recent_uploads.object_key is immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.bucket       IS DISTINCT FROM OLD.bucket       THEN RAISE EXCEPTION 'recent_uploads.bucket is immutable'       USING ERRCODE = '42501'; END IF;
  IF NEW.namespace    IS DISTINCT FROM OLD.namespace    THEN RAISE EXCEPTION 'recent_uploads.namespace is immutable'    USING ERRCODE = '42501'; END IF;
  IF NEW.region       IS DISTINCT FROM OLD.region       THEN RAISE EXCEPTION 'recent_uploads.region is immutable'       USING ERRCODE = '42501'; END IF;
  IF NEW.file_size    IS DISTINCT FROM OLD.file_size    THEN RAISE EXCEPTION 'recent_uploads.file_size is immutable'    USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_recent_uploads_immutable ON public.recent_uploads;
CREATE TRIGGER trg_recent_uploads_immutable
  BEFORE UPDATE ON public.recent_uploads
  FOR EACH ROW EXECUTE FUNCTION public.recent_uploads_immutable_guard();
