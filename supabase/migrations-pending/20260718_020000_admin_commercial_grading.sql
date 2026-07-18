BEGIN;

ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS content_grade text;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS partner_grade text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_titles_content_grade_check'
  ) THEN
    ALTER TABLE public.content_titles
      ADD CONSTRAINT content_titles_content_grade_check
      CHECK (content_grade IS NULL OR content_grade IN ('a','b','c'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_partner_grade_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_partner_grade_check
      CHECK (partner_grade IS NULL OR partner_grade IN ('a','b','c'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.commercial_grade_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('title','partner')),
  entity_id uuid NOT NULL,
  previous_grade text CHECK (previous_grade IS NULL OR previous_grade IN ('a','b','c')),
  new_grade text NOT NULL CHECK (new_grade IN ('a','b','c')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  actor_user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commercial_grade_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_grade_audit_admin_select" ON public.commercial_grade_audit;
CREATE POLICY "commercial_grade_audit_admin_select"
ON public.commercial_grade_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'founder'));

REVOKE ALL ON public.commercial_grade_audit FROM anon, authenticated;
GRANT SELECT ON public.commercial_grade_audit TO authenticated;
GRANT ALL ON public.commercial_grade_audit TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_commercial_grade(
  _entity_type text,
  _entity_id uuid,
  _grade text,
  _reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _previous text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF _entity_type NOT IN ('title','partner') OR _grade NOT IN ('a','b','c') OR length(btrim(coalesce(_reason,''))) < 3 THEN
    RAISE EXCEPTION 'Invalid classification request';
  END IF;

  IF _entity_type = 'title' THEN
    SELECT content_grade INTO _previous FROM public.content_titles WHERE id = _entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Title not found'; END IF;
    UPDATE public.content_titles SET content_grade = _grade, updated_at = now() WHERE id = _entity_id;
  ELSE
    SELECT partner_grade INTO _previous FROM public.user_profiles WHERE user_id = _entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Partner not found'; END IF;
    UPDATE public.user_profiles SET partner_grade = _grade, updated_at = now() WHERE user_id = _entity_id;
  END IF;

  INSERT INTO public.commercial_grade_audit(entity_type, entity_id, previous_grade, new_grade, reason)
  VALUES (_entity_type, _entity_id, _previous, _grade, btrim(_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_commercial_grade(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_commercial_grade(text,uuid,text,text) TO authenticated, service_role;

COMMIT;
