-- ============================================================================
-- Title canonical-fields backfill (Phase A of the stability update).
--
-- STATUS: NOT EXECUTED. Held in supabase/migrations-pending/ so the
-- migration runner will not pick it up. Move into supabase/migrations/
-- only after explicit approval.
--
-- What this migration does:
--   1. Adds a nullable `client_draft_id uuid` column to content_titles so
--      title creation can be idempotent across retries and rapid clicks.
--      A partial unique index scopes the constraint to (owner_user_id,
--      client_draft_id) rows where the value is set.
--   2. Creates `title_backfill_conflicts` to record rows whose canonical
--      column disagrees with metadata — a human resolves those; we never
--      merge silently.
--   3. Backfills canonical columns (synopsis, language, genre,
--      duration_minutes) from metadata JSON *only* when the canonical
--      side is currently NULL/blank AND metadata carries a valid value.
--      Rows where both sides disagree are logged to
--      title_backfill_conflicts and left untouched.
--
-- Idempotency:
--   Every statement is safe to run multiple times (IF NOT EXISTS, WHERE
--   guards). Re-running only picks up newly-missing values.
--
-- Rollback:
--   The column, index, and conflicts table can be dropped independently;
--   the backfill only fills NULLs and never modifies non-NULL data.
-- ============================================================================

BEGIN;

-- 1. client_draft_id column + owner-scoped partial unique index -------------
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS client_draft_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS content_titles_owner_client_draft_idx
  ON public.content_titles (owner_user_id, client_draft_id)
  WHERE client_draft_id IS NOT NULL;

COMMENT ON COLUMN public.content_titles.client_draft_id IS
  'Client-generated UUID used to make title creation idempotent across '
  'retries. Nullable; unique per owner when set.';

-- 2. Conflict review table --------------------------------------------------
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

GRANT SELECT ON public.title_backfill_conflicts TO authenticated;
GRANT ALL    ON public.title_backfill_conflicts TO service_role;

ALTER TABLE public.title_backfill_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins view conflicts" ON public.title_backfill_conflicts;
CREATE POLICY "admins view conflicts"
  ON public.title_backfill_conflicts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
  );

-- 3. Detect conflicts BEFORE any backfill so we never lose evidence. ---------
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'synopsis',
       nullif(btrim(synopsis), ''),
       nullif(btrim(metadata->>'synopsis'), '')
  FROM public.content_titles
 WHERE nullif(btrim(synopsis), '') IS NOT NULL
   AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL
   AND btrim(synopsis) <> btrim(metadata->>'synopsis')
ON CONFLICT (title_id, field) DO NOTHING;

INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'language',
       nullif(btrim(language), ''),
       nullif(btrim(metadata->>'original_language'), '')
  FROM public.content_titles
 WHERE nullif(btrim(language), '') IS NOT NULL
   AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL
   AND lower(btrim(language)) <> lower(btrim(metadata->>'original_language'))
ON CONFLICT (title_id, field) DO NOTHING;

INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'genre',
       nullif(btrim(genre), ''),
       nullif(metadata->'genres'->>0, '')
  FROM public.content_titles
 WHERE nullif(btrim(genre), '') IS NOT NULL
   AND nullif(metadata->'genres'->>0, '') IS NOT NULL
   AND lower(btrim(genre)) <> lower(btrim(metadata->'genres'->>0))
ON CONFLICT (title_id, field) DO NOTHING;

INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'duration_minutes',
       duration_minutes::text,
       nullif(metadata->>'runtime_minutes', '')
  FROM public.content_titles
 WHERE duration_minutes IS NOT NULL AND duration_minutes > 0
   AND (metadata->>'runtime_minutes') ~ '^[0-9]+$'
   AND (metadata->>'runtime_minutes')::int > 0
   AND duration_minutes <> (metadata->>'runtime_minutes')::int
ON CONFLICT (title_id, field) DO NOTHING;

-- 4. Backfill NULL/blank canonical columns from metadata when valid. --------
UPDATE public.content_titles
   SET synopsis = btrim(metadata->>'synopsis')
 WHERE (synopsis IS NULL OR btrim(synopsis) = '')
   AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL;

UPDATE public.content_titles
   SET language = btrim(metadata->>'original_language')
 WHERE (language IS NULL OR btrim(language) = '')
   AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL;

UPDATE public.content_titles
   SET genre = btrim(metadata->'genres'->>0)
 WHERE (genre IS NULL OR btrim(genre) = '')
   AND nullif(btrim(metadata->'genres'->>0), '') IS NOT NULL;

UPDATE public.content_titles
   SET duration_minutes = (metadata->>'runtime_minutes')::int
 WHERE (duration_minutes IS NULL OR duration_minutes = 0)
   AND (metadata->>'runtime_minutes') ~ '^[0-9]+$'
   AND (metadata->>'runtime_minutes')::int > 0;

-- 5. Backfill metadata JSON from canonical columns when metadata is empty. --
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
   AND coalesce(jsonb_array_length(metadata->'genres'), 0) = 0;

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{runtime_minutes}', to_jsonb(duration_minutes), true)
 WHERE duration_minutes IS NOT NULL AND duration_minutes > 0
   AND coalesce((metadata->>'runtime_minutes')::int, 0) = 0;

COMMIT;

-- ---------------------------------------------------------------------------
-- rollback (manual, for reference only)
--
--   DROP INDEX IF EXISTS public.content_titles_owner_client_draft_idx;
--   ALTER TABLE public.content_titles DROP COLUMN IF EXISTS client_draft_id;
--   DROP TABLE IF EXISTS public.title_backfill_conflicts;
-- ---------------------------------------------------------------------------
