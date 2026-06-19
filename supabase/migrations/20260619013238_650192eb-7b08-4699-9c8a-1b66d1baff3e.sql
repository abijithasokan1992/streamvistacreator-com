
-- 1. Extend content_status enum (idempotent)
DO $$
BEGIN
  BEGIN ALTER TYPE public.content_status ADD VALUE 'incomplete'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.content_status ADD VALUE 'qc_review'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.content_status ADD VALUE 'legal_review'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.content_status ADD VALUE 'hold'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.content_status ADD VALUE 'changes_requested'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.content_status ADD VALUE 'rejected'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;

-- 2. title_assets linking table
CREATE TABLE IF NOT EXISTS public.title_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES public.recent_uploads(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'feature_film','trailer','poster','artwork','captions','subtitle',
    'audio','censor_cert','legal','sales','ownership'
  )),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS title_assets_title_cat_idx
  ON public.title_assets (title_id, category, is_primary DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_assets TO authenticated;
GRANT ALL ON public.title_assets TO service_role;

ALTER TABLE public.title_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ta_select_owner_or_admin" ON public.title_assets;
CREATE POLICY "ta_select_owner_or_admin" ON public.title_assets FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = title_id AND t.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ta_insert_owner" ON public.title_assets;
CREATE POLICY "ta_insert_owner" ON public.title_assets FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.content_titles t
      WHERE t.id = title_id AND t.owner_user_id = auth.uid() AND t.locked = false
    )
  );

DROP POLICY IF EXISTS "ta_update_owner" ON public.title_assets;
CREATE POLICY "ta_update_owner" ON public.title_assets FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = title_id AND t.owner_user_id = auth.uid() AND t.locked = false)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = title_id AND t.owner_user_id = auth.uid() AND t.locked = false)
  );

DROP POLICY IF EXISTS "ta_delete_owner" ON public.title_assets;
CREATE POLICY "ta_delete_owner" ON public.title_assets FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = title_id AND t.owner_user_id = auth.uid() AND t.locked = false)
  );

-- 3. Lock guard trigger on title_assets
CREATE OR REPLACE FUNCTION public.title_assets_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_locked boolean;
  t_id uuid;
BEGIN
  t_id := COALESCE(NEW.title_id, OLD.title_id);
  SELECT locked INTO t_locked FROM public.content_titles WHERE id = t_id;
  IF t_locked = true
     AND NOT (public.has_role(auth.uid(),'admin'::public.app_role)
              OR public.is_super_admin(auth.uid()))
  THEN
    RAISE EXCEPTION 'Title is locked' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS title_assets_lock_guard_trg ON public.title_assets;
CREATE TRIGGER title_assets_lock_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.title_assets
  FOR EACH ROW EXECUTE FUNCTION public.title_assets_lock_guard();
