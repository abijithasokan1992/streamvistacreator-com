
-- Staging table for legacy film imports from the old (scrapped) app.
-- Data sits here keyed by the original uploader's email. When that user signs
-- in via magic link, they can claim their films as drafts in content_titles.

CREATE TABLE public.legacy_film_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_film_id integer NOT NULL UNIQUE,
  uploader_email text NOT NULL,
  payload jsonb NOT NULL,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  content_title_id uuid REFERENCES public.content_titles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legacy_film_imports_email_idx ON public.legacy_film_imports (lower(uploader_email)) WHERE claimed_at IS NULL;

GRANT SELECT ON public.legacy_film_imports TO authenticated;
GRANT ALL ON public.legacy_film_imports TO service_role;

ALTER TABLE public.legacy_film_imports ENABLE ROW LEVEL SECURITY;

-- A signed-in user can only see rows matching their own email.
CREATE POLICY "own email can view legacy imports"
ON public.legacy_film_imports FOR SELECT
TO authenticated
USING (
  lower(uploader_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  OR has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
);

-- Claim function: creates content_titles drafts for every unclaimed legacy
-- film whose uploader_email matches the caller's auth.users.email.
-- Returns count of newly claimed films. Idempotent.
CREATE OR REPLACE FUNCTION public.claim_legacy_films()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email   text;
  v_row     public.legacy_film_imports%ROWTYPE;
  v_new_id  uuid;
  v_count   integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT * FROM public.legacy_film_imports
    WHERE lower(uploader_email) = lower(v_email)
      AND claimed_at IS NULL
  LOOP
    INSERT INTO public.content_titles (
      owner_user_id, title, synopsis, language, duration_minutes, status, metadata
    ) VALUES (
      v_user_id,
      COALESCE(NULLIF(v_row.payload->>'title',''), 'Untitled (legacy #' || v_row.legacy_film_id || ')'),
      v_row.payload->>'description',
      v_row.payload->>'language',
      NULLIF(v_row.payload->>'duration','')::int,
      'draft'::content_status,
      jsonb_build_object(
        'legacy_import', true,
        'legacy_film_id', v_row.legacy_film_id,
        'director', v_row.payload->>'director',
        'producer', v_row.payload->>'producer',
        'cast', v_row.payload->>'cast',
        'country', v_row.payload->>'country',
        'content_type', v_row.payload->>'content_type',
        'budget', v_row.payload->>'budget',
        'legacy_poster', v_row.payload->>'poster',
        'legacy_trailer', v_row.payload->>'trailer',
        'legacy_video', v_row.payload->>'video_file'
      )
    )
    RETURNING id INTO v_new_id;

    UPDATE public.legacy_film_imports
    SET claimed_by_user_id = v_user_id,
        claimed_at = now(),
        content_title_id = v_new_id,
        updated_at = now()
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_films() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_legacy_films() TO authenticated;
