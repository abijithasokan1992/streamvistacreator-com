BEGIN;

-- PART 1 — Title canonical backfill

ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS client_draft_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS content_titles_owner_client_draft_idx
  ON public.content_titles (owner_user_id, client_draft_id)
  WHERE client_draft_id IS NOT NULL;

COMMENT ON COLUMN public.content_titles.client_draft_id IS
  'Client-generated UUID used to make title creation idempotent across retries. Nullable; unique per owner when set.';

CREATE TABLE IF NOT EXISTS public.title_backfill_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('synopsis','language','genre','duration_minutes')),
  canonical_value text,
  metadata_value text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  resolution text,
  UNIQUE (title_id, field)
);

GRANT SELECT, UPDATE ON public.title_backfill_conflicts TO authenticated;
GRANT ALL            ON public.title_backfill_conflicts TO service_role;

ALTER TABLE public.title_backfill_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "privileged roles view conflicts" ON public.title_backfill_conflicts;
CREATE POLICY "privileged roles view conflicts"
  ON public.title_backfill_conflicts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  );

DROP POLICY IF EXISTS "privileged roles resolve conflicts" ON public.title_backfill_conflicts;
CREATE POLICY "privileged roles resolve conflicts"
  ON public.title_backfill_conflicts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  );

INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'synopsis', nullif(btrim(synopsis), ''), nullif(btrim(metadata->>'synopsis'), '')
  FROM public.content_titles
 WHERE nullif(btrim(synopsis), '') IS NOT NULL
   AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL
   AND btrim(synopsis) <> btrim(metadata->>'synopsis')
ON CONFLICT (title_id, field) DO NOTHING;

INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'language', nullif(btrim(language), ''), nullif(btrim(metadata->>'original_language'), '')
  FROM public.content_titles
 WHERE nullif(btrim(language), '') IS NOT NULL
   AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL
   AND lower(btrim(language)) <> lower(btrim(metadata->>'original_language'))
ON CONFLICT (title_id, field) DO NOTHING;

WITH candidates AS (
  SELECT c.id,
    nullif(btrim(c.genre), '') AS canonical_genre,
    CASE WHEN jsonb_typeof(c.metadata->'genres') = 'array' AND jsonb_array_length(c.metadata->'genres') > 0
         THEN nullif(btrim(c.metadata->'genres'->>0), '') ELSE NULL END AS metadata_genre
  FROM public.content_titles c
)
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'genre', canonical_genre, metadata_genre
  FROM candidates
 WHERE canonical_genre IS NOT NULL AND metadata_genre IS NOT NULL
   AND lower(canonical_genre) <> lower(metadata_genre)
ON CONFLICT (title_id, field) DO NOTHING;

WITH candidates AS (
  SELECT c.id, c.duration_minutes,
    CASE WHEN (c.metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
         THEN (c.metadata->>'runtime_minutes')::int ELSE NULL END AS parsed_runtime
  FROM public.content_titles c
)
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'duration_minutes', duration_minutes::text, parsed_runtime::text
  FROM candidates
 WHERE duration_minutes IS NOT NULL AND duration_minutes > 0
   AND parsed_runtime IS NOT NULL AND parsed_runtime BETWEEN 1 AND 14400
   AND duration_minutes <> parsed_runtime
ON CONFLICT (title_id, field) DO NOTHING;

-- Disable USER triggers on content_titles for maintenance UPDATEs only.
ALTER TABLE public.content_titles DISABLE TRIGGER USER;

UPDATE public.content_titles
   SET synopsis = btrim(metadata->>'synopsis')
 WHERE (synopsis IS NULL OR btrim(synopsis) = '')
   AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL;

UPDATE public.content_titles
   SET language = btrim(metadata->>'original_language')
 WHERE (language IS NULL OR btrim(language) = '')
   AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL;

WITH safe_genre AS (
  SELECT c.id,
    CASE WHEN jsonb_typeof(c.metadata->'genres') = 'array' AND jsonb_array_length(c.metadata->'genres') > 0
         THEN nullif(btrim(c.metadata->'genres'->>0), '') ELSE NULL END AS g
  FROM public.content_titles c
  WHERE c.genre IS NULL OR btrim(c.genre) = ''
)
UPDATE public.content_titles t SET genre = s.g FROM safe_genre s
 WHERE t.id = s.id AND s.g IS NOT NULL;

WITH safe_runtime AS (
  SELECT c.id,
    CASE WHEN (c.metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
         THEN (c.metadata->>'runtime_minutes')::int ELSE NULL END AS r
  FROM public.content_titles c
  WHERE c.duration_minutes IS NULL OR c.duration_minutes = 0
)
UPDATE public.content_titles t SET duration_minutes = s.r FROM safe_runtime s
 WHERE t.id = s.id AND s.r IS NOT NULL AND s.r BETWEEN 1 AND 14400;

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{synopsis}', to_jsonb(synopsis), true)
 WHERE synopsis IS NOT NULL AND btrim(synopsis) <> ''
   AND coalesce(nullif(btrim(metadata->>'synopsis'), ''), '') = '';

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{original_language}', to_jsonb(language), true)
 WHERE language IS NOT NULL AND btrim(language) <> ''
   AND coalesce(nullif(btrim(metadata->>'original_language'), ''), '') = '';

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{genres}', to_jsonb(ARRAY[genre]), true)
 WHERE genre IS NOT NULL AND btrim(genre) <> ''
   AND (jsonb_typeof(metadata->'genres') IS DISTINCT FROM 'array'
        OR jsonb_array_length(metadata->'genres') = 0);

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{runtime_minutes}', to_jsonb(duration_minutes), true)
 WHERE duration_minutes IS NOT NULL AND duration_minutes > 0
   AND ((metadata->>'runtime_minutes') IS NULL
     OR (metadata->>'runtime_minutes') !~ '^[0-9]{1,5}$'
     OR (CASE WHEN (metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
              THEN (metadata->>'runtime_minutes')::int ELSE NULL END) NOT BETWEEN 1 AND 14400);

-- Re-enable triggers immediately after backfill.
ALTER TABLE public.content_titles ENABLE TRIGGER USER;

-- PART 2 — DIT ingest screenshots policies (bucket already exists)

DROP POLICY IF EXISTS "dit_screenshots_owner_read"   ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_write"  ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "dit_screenshots_admin_read"   ON storage.objects;

CREATE POLICY "dit_screenshots_owner_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dit_screenshots_owner_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dit-ingest-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dit_screenshots_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'dit-ingest-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dit_screenshots_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dit-ingest-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dit_screenshots_admin_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dit-ingest-screenshots'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'platform_owner')
      OR public.has_role(auth.uid(), 'founder')
      OR public.has_role(auth.uid(), 'qc_reviewer')
    )
  );

-- PART 3 — Self-approval guard on content_approvals

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT owner_user_id INTO v_owner
    FROM public.content_titles
   WHERE id = NEW.title_id;

  IF v_owner IS NOT NULL
     AND NEW.actor_user_id IS NOT NULL
     AND v_owner = NEW.actor_user_id THEN
    RAISE EXCEPTION 'Self-approval is not permitted: actor % owns title %',
      NEW.actor_user_id, NEW.title_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.content_approvals;
CREATE TRIGGER trg_prevent_self_approval
  BEFORE INSERT OR UPDATE ON public.content_approvals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_approval();

COMMIT;