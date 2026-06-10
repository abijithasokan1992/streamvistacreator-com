
-- 1) REVIEW LINK SECRETS
CREATE TABLE IF NOT EXISTS public.review_link_secrets (
  review_link_id uuid PRIMARY KEY REFERENCES public.review_links(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  password_hash_algo text NOT NULL DEFAULT 'sha256',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.review_link_secrets TO service_role;
ALTER TABLE public.review_link_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.review_link_secrets (review_link_id, password_hash, password_salt, password_hash_algo)
SELECT id, password_hash, COALESCE(password_salt, ''), COALESCE(password_hash_algo, 'sha256')
FROM public.review_links WHERE password_hash IS NOT NULL
ON CONFLICT (review_link_id) DO NOTHING;

ALTER TABLE public.review_links ADD COLUMN IF NOT EXISTS requires_password boolean NOT NULL DEFAULT false;
UPDATE public.review_links SET requires_password = (password_hash IS NOT NULL);

DROP VIEW IF EXISTS public.review_links_safe;
ALTER TABLE public.review_links DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.review_links DROP COLUMN IF EXISTS password_salt;
ALTER TABLE public.review_links DROP COLUMN IF EXISTS password_hash_algo;

-- 2) SHARED FILE SECRETS
CREATE TABLE IF NOT EXISTS public.shared_file_secrets (
  shared_file_id uuid PRIMARY KEY REFERENCES public.shared_files(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_salt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shared_file_secrets TO service_role;
ALTER TABLE public.shared_file_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.shared_file_secrets (shared_file_id, password_hash, password_salt)
SELECT id, password_hash, password_salt FROM public.shared_files WHERE password_hash IS NOT NULL
ON CONFLICT (shared_file_id) DO NOTHING;

-- has_password was a STORED generated column derived from password_hash; redefine as plain boolean
ALTER TABLE public.shared_files DROP COLUMN IF EXISTS has_password;
ALTER TABLE public.shared_files DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.shared_files DROP COLUMN IF EXISTS password_salt;
ALTER TABLE public.shared_files ADD COLUMN has_password boolean NOT NULL DEFAULT false;
UPDATE public.shared_files sf SET has_password = true
  WHERE EXISTS (SELECT 1 FROM public.shared_file_secrets s WHERE s.shared_file_id = sf.id);

-- 3) INTRO INVITE SECRETS
CREATE TABLE IF NOT EXISTS public.intro_invite_secrets (
  intro_invite_id uuid PRIMARY KEY REFERENCES public.intro_invites(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.intro_invite_secrets TO service_role;
ALTER TABLE public.intro_invite_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.intro_invite_secrets (intro_invite_id, token)
SELECT id, token FROM public.intro_invites WHERE token IS NOT NULL
ON CONFLICT (intro_invite_id) DO NOTHING;

-- Update accept_intro_invite_on_signup trigger function to read from secrets table is unnecessary —
-- it matches by email, not by token, so dropping the token column is safe.
ALTER TABLE public.intro_invites DROP COLUMN IF EXISTS token;

-- 4) ONBOARDING REQUESTS — optional submitter ownership
ALTER TABLE public.onboarding_requests
  ADD COLUMN IF NOT EXISTS submitter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_onboarding_requests_submitter ON public.onboarding_requests(submitter_user_id);

DROP POLICY IF EXISTS "Submitters can view their own onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Submitters can view their own onboarding requests"
  ON public.onboarding_requests FOR SELECT TO authenticated
  USING (submitter_user_id IS NOT NULL AND submitter_user_id = auth.uid());

DROP POLICY IF EXISTS "Submitters can delete their own onboarding requests" ON public.onboarding_requests;
CREATE POLICY "Submitters can delete their own onboarding requests"
  ON public.onboarding_requests FOR DELETE TO authenticated
  USING (submitter_user_id IS NOT NULL AND submitter_user_id = auth.uid());
