
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

UPDATE public.user_profiles
SET full_name = 'Abijith Asokan',
    display_name = COALESCE(NULLIF(display_name,''), 'Abijith Asokan'),
    job_title = 'Founder & Managing Director',
    organization_name = 'StreamVista OPC Pvt Ltd',
    updated_at = now()
WHERE user_id = '75537ca1-e84f-4e80-a468-f38dc157a2ac';

INSERT INTO public.user_profiles (user_id, display_name, full_name, job_title, organization_name, plan_tier)
SELECT '75537ca1-e84f-4e80-a468-f38dc157a2ac', 'Abijith Asokan', 'Abijith Asokan',
       'Founder & Managing Director', 'StreamVista OPC Pvt Ltd', 'free'
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = '75537ca1-e84f-4e80-a468-f38dc157a2ac');
