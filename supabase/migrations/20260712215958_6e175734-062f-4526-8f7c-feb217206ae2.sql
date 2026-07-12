
-- Scope correction: Creator gets SELECT-only on title_publishing and title_localizations.
-- Admin/platform writes are unaffected (separate admin policies already exist).

-- title_publishing: drop creator write policies, keep select
DROP POLICY IF EXISTS tp_owner_insert ON public.title_publishing;
DROP POLICY IF EXISTS tp_owner_update ON public.title_publishing;
DROP POLICY IF EXISTS tp_owner_delete ON public.title_publishing;

-- title_localizations: drop creator write policies, keep select
DROP POLICY IF EXISTS tl_owner_insert ON public.title_localizations;
DROP POLICY IF EXISTS tl_owner_update ON public.title_localizations;
DROP POLICY IF EXISTS tl_owner_delete ON public.title_localizations;
