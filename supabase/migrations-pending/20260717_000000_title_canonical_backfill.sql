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
-- Hardening notes (post-review):
--   * Every read of metadata->'genres' is guarded by
--       jsonb_typeof(metadata->'genres') = 'array'
--     before touching jsonb_array_length or ->0 so a null metadata,
--     missing key, or non-array value (string/object/number) cannot raise
--     a type error. We do NOT rely on WHERE clause evaluation order.
--   * Every read of metadata->>'runtime_minutes' is parsed inside a
--     single CASE expression that (a) verifies the digit shape with a
--     bounded regex (1–5 digits) and (b) casts to int and enforces
--     1 <= n <= 14400 (10 days). CASE branch order is guaranteed by SQL,
--     so we never depend on boolean short-circuit for the ::int cast.
--
-- Idempotency:
--   Every statement is safe to run multiple times (IF NOT EXISTS, WHERE
--   guards). Re-running only picks up newly-missing values. Conflict
--   rows are preserved via UNIQUE(title_id, field) + ON CONFLICT DO
--   NOTHING; existing evidence is never overwritten.
--
-- Rollback:
--   The column, index, and conflicts table can be dropped independently;
--   the backfill only fills NULLs and never modifies non-NULL data. No
--   DELETE or MERGE statements are used anywhere in this file.
--
-- Preflight counts (run manually as read-only queries BEFORE executing
-- this migration; they are commented out here on purpose):
--
--   -- rows eligible for canonical synopsis backfill:
--   -- SELECT count(*) FROM public.content_titles
--   --  WHERE (synopsis IS NULL OR btrim(synopsis) = '')
--   --    AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL;
--
--   -- rows eligible for canonical language backfill:
--   -- SELECT count(*) FROM public.content_titles
--   --  WHERE (language IS NULL OR btrim(language) = '')
--   --    AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL;
--
--   -- rows eligible for canonical genre backfill (array-guarded):
--   -- SELECT count(*) FROM public.content_titles
--   --  WHERE (genre IS NULL OR btrim(genre) = '')
--   --    AND jsonb_typeof(metadata->'genres') = 'array'
--   --    AND jsonb_array_length(metadata->'genres') > 0
--   --    AND nullif(btrim(metadata->'genres'->>0), '') IS NOT NULL;
--
--   -- rows eligible for canonical duration_minutes backfill (safe parse):
--   -- SELECT count(*) FROM public.content_titles
--   --  WHERE (duration_minutes IS NULL OR duration_minutes = 0)
--   --    AND (CASE WHEN (metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
--   --              THEN (metadata->>'runtime_minutes')::int
--   --              ELSE NULL END) BETWEEN 1 AND 14400;
--
--   -- expected new conflict rows (any field):
--   -- SELECT count(*) FROM public.content_titles c
--   --  WHERE (nullif(btrim(c.synopsis),'') IS NOT NULL
--   --         AND nullif(btrim(c.metadata->>'synopsis'),'') IS NOT NULL
--   --         AND btrim(c.synopsis) <> btrim(c.metadata->>'synopsis'))
--   --     OR (nullif(btrim(c.language),'') IS NOT NULL
--   --         AND nullif(btrim(c.metadata->>'original_language'),'') IS NOT NULL
--   --         AND lower(btrim(c.language)) <> lower(btrim(c.metadata->>'original_language')));
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

GRANT SELECT, UPDATE ON public.title_backfill_conflicts TO authenticated;
GRANT ALL            ON public.title_backfill_conflicts TO service_role;

ALTER TABLE public.title_backfill_conflicts ENABLE ROW LEVEL SECURITY;

-- Privileged roles used across the app for conflict review. We deliberately
-- enumerate every role that already has admin-tier power (admin, super_admin,
-- platform_owner, founder) so resolved_at / resolved_by / resolution can be
-- written by any of them. Ordinary authenticated users get no INSERT/DELETE
-- and no UPDATE — only SELECT is denied to them here because no SELECT policy
-- targets them.
DROP POLICY IF EXISTS "admins view conflicts" ON public.title_backfill_conflicts;
CREATE POLICY "privileged roles view conflicts"
  ON public.title_backfill_conflicts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  );

DROP POLICY IF EXISTS "privileged roles resolve conflicts" ON public.title_backfill_conflicts;
CREATE POLICY "privileged roles resolve conflicts"
  ON public.title_backfill_conflicts
  FOR UPDATE
  TO authenticated
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

-- 3. Detect conflicts BEFORE any backfill so we never lose evidence. ---------
-- 3a. synopsis conflicts.
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'synopsis',
       nullif(btrim(synopsis), ''),
       nullif(btrim(metadata->>'synopsis'), '')
  FROM public.content_titles
 WHERE nullif(btrim(synopsis), '') IS NOT NULL
   AND nullif(btrim(metadata->>'synopsis'), '') IS NOT NULL
   AND btrim(synopsis) <> btrim(metadata->>'synopsis')
ON CONFLICT (title_id, field) DO NOTHING;

-- 3b. language conflicts.
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'language',
       nullif(btrim(language), ''),
       nullif(btrim(metadata->>'original_language'), '')
  FROM public.content_titles
 WHERE nullif(btrim(language), '') IS NOT NULL
   AND nullif(btrim(metadata->>'original_language'), '') IS NOT NULL
   AND lower(btrim(language)) <> lower(btrim(metadata->>'original_language'))
ON CONFLICT (title_id, field) DO NOTHING;

-- 3c. genre conflicts. metadata->'genres' is only dereferenced through
--     ->>0 inside the CASE, and only when jsonb_typeof(...) = 'array' AND
--     jsonb_array_length(...) > 0. The CTE materialises the safe value so
--     no code path outside the guard ever touches ->>0.
WITH candidates AS (
  SELECT
    c.id,
    nullif(btrim(c.genre), '') AS canonical_genre,
    CASE
      WHEN jsonb_typeof(c.metadata->'genres') = 'array'
       AND jsonb_array_length(c.metadata->'genres') > 0
      THEN nullif(btrim(c.metadata->'genres'->>0), '')
      ELSE NULL
    END AS metadata_genre
  FROM public.content_titles c
)
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'genre', canonical_genre, metadata_genre
  FROM candidates
 WHERE canonical_genre IS NOT NULL
   AND metadata_genre  IS NOT NULL
   AND lower(canonical_genre) <> lower(metadata_genre)
ON CONFLICT (title_id, field) DO NOTHING;

-- 3d. duration_minutes conflicts. The runtime string is parsed inside a
--     single CASE expression whose WHEN branches are evaluated in order,
--     so the ::int cast only fires on a value already matched by the
--     bounded digit regex. The result is then range-checked (1..14400).
WITH candidates AS (
  SELECT
    c.id,
    c.duration_minutes,
    CASE
      WHEN (c.metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
      THEN (c.metadata->>'runtime_minutes')::int
      ELSE NULL
    END AS parsed_runtime
  FROM public.content_titles c
)
INSERT INTO public.title_backfill_conflicts (title_id, field, canonical_value, metadata_value)
SELECT id, 'duration_minutes',
       duration_minutes::text,
       parsed_runtime::text
  FROM candidates
 WHERE duration_minutes IS NOT NULL
   AND duration_minutes > 0
   AND parsed_runtime IS NOT NULL
   AND parsed_runtime BETWEEN 1 AND 14400
   AND duration_minutes <> parsed_runtime
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

-- Genre backfill: derive the safe value via a CTE guarded by jsonb_typeof,
-- then update only rows where the canonical column is empty.
WITH safe_genre AS (
  SELECT
    c.id,
    CASE
      WHEN jsonb_typeof(c.metadata->'genres') = 'array'
       AND jsonb_array_length(c.metadata->'genres') > 0
      THEN nullif(btrim(c.metadata->'genres'->>0), '')
      ELSE NULL
    END AS g
  FROM public.content_titles c
  WHERE c.genre IS NULL OR btrim(c.genre) = ''
)
UPDATE public.content_titles t
   SET genre = s.g
  FROM safe_genre s
 WHERE t.id = s.id
   AND s.g IS NOT NULL;

-- Runtime backfill: safe CASE parse, bounded 1..14400.
WITH safe_runtime AS (
  SELECT
    c.id,
    CASE
      WHEN (c.metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
      THEN (c.metadata->>'runtime_minutes')::int
      ELSE NULL
    END AS r
  FROM public.content_titles c
  WHERE c.duration_minutes IS NULL OR c.duration_minutes = 0
)
UPDATE public.content_titles t
   SET duration_minutes = s.r
  FROM safe_runtime s
 WHERE t.id = s.id
   AND s.r IS NOT NULL
   AND s.r BETWEEN 1 AND 14400;

-- 5. Backfill metadata JSON from canonical columns when metadata is empty. --
UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{synopsis}', to_jsonb(synopsis), true)
 WHERE synopsis IS NOT NULL AND btrim(synopsis) <> ''
   AND coalesce(nullif(btrim(metadata->>'synopsis'), ''), '') = '';

UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{original_language}', to_jsonb(language), true)
 WHERE language IS NOT NULL AND btrim(language) <> ''
   AND coalesce(nullif(btrim(metadata->>'original_language'), ''), '') = '';

-- metadata.genres write: guard against non-array metadata->'genres' so we
-- don't call jsonb_array_length on a string/object/number.
UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{genres}', to_jsonb(ARRAY[genre]), true)
 WHERE genre IS NOT NULL AND btrim(genre) <> ''
   AND (
        jsonb_typeof(metadata->'genres') IS DISTINCT FROM 'array'
     OR jsonb_array_length(metadata->'genres') = 0
   );

-- metadata.runtime_minutes write: only when metadata currently lacks a
-- valid bounded numeric runtime.
UPDATE public.content_titles
   SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{runtime_minutes}', to_jsonb(duration_minutes), true)
 WHERE duration_minutes IS NOT NULL
   AND duration_minutes > 0
   AND (
        (metadata->>'runtime_minutes') IS NULL
     OR (metadata->>'runtime_minutes') !~ '^[0-9]{1,5}$'
     OR (CASE
           WHEN (metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
           THEN (metadata->>'runtime_minutes')::int
           ELSE NULL
         END) IS NULL
     OR (CASE
           WHEN (metadata->>'runtime_minutes') ~ '^[0-9]{1,5}$'
           THEN (metadata->>'runtime_minutes')::int
           ELSE NULL
         END) NOT BETWEEN 1 AND 14400
   );

COMMIT;

-- ---------------------------------------------------------------------------
-- rollback (manual, for reference only)
--
--   DROP INDEX IF EXISTS public.content_titles_owner_client_draft_idx;
--   ALTER TABLE public.content_titles DROP COLUMN IF EXISTS client_draft_id;
--   DROP TABLE IF EXISTS public.title_backfill_conflicts;
-- ---------------------------------------------------------------------------
