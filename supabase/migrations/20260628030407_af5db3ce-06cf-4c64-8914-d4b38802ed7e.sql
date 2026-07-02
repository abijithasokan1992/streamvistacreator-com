ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS purchased_title_slots integer NOT NULL DEFAULT 0;