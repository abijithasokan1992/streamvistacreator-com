ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS locale text
  CHECK (locale IS NULL OR locale IN ('en', 'ml'));