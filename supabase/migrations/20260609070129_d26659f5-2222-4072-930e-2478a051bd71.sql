
ALTER TABLE public.premium_invitations
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';

ALTER TABLE public.premium_invitations
  DROP CONSTRAINT IF EXISTS premium_invitations_account_type_check;
ALTER TABLE public.premium_invitations
  ADD CONSTRAINT premium_invitations_account_type_check
  CHECK (account_type IN ('personal','professional'));

CREATE INDEX IF NOT EXISTS premium_invitations_created_by_type_idx
  ON public.premium_invitations(created_by, account_type);
