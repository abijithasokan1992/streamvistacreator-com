
-- 1. intro_invites: fix UPDATE policy to block immutable fields
DROP POLICY IF EXISTS "Inviters can update their intro invites" ON public.intro_invites;

CREATE POLICY "Inviters can update their intro invites"
ON public.intro_invites
FOR UPDATE
TO authenticated
USING (inviter_user_id = auth.uid())
WITH CHECK (
  inviter_user_id = auth.uid()
  AND id = (SELECT i.id FROM public.intro_invites i WHERE i.id = intro_invites.id)
);

-- Trigger enforces immutability of email/token-like fields and timestamps
CREATE OR REPLACE FUNCTION public.intro_invites_block_immutable_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.email IS DISTINCT FROM OLD.email
       OR NEW.inviter_user_id IS DISTINCT FROM OLD.inviter_user_id
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.accepted_user_id IS DISTINCT FROM OLD.accepted_user_id
       OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.first_name IS DISTINCT FROM OLD.first_name
       OR NEW.last_name IS DISTINCT FROM OLD.last_name
    THEN
      RAISE EXCEPTION 'Immutable field modification not allowed on intro_invites';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intro_invites_block_immutable ON public.intro_invites;
CREATE TRIGGER intro_invites_block_immutable
  BEFORE UPDATE ON public.intro_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.intro_invites_block_immutable_updates();

-- 2. onboarding_requests: secure anon SELECT scoped to session access_code
DROP POLICY IF EXISTS "Anon submitters read own session submission" ON public.onboarding_requests;

CREATE POLICY "Anon submitters read own session submission"
ON public.onboarding_requests
FOR SELECT
TO anon
USING (
  submitter_user_id IS NULL
  AND access_code IS NOT NULL
  AND access_code = NULLIF(current_setting('request.onboarding_access_code', true), '')
);

-- 3. Vault storage: workspace members can read vault files of fellow members
DROP POLICY IF EXISTS "Workspace members read shared vault" ON storage.objects;

CREATE POLICY "Workspace members read shared vault"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vault'
  AND EXISTS (
    SELECT 1
    FROM public.workspace_members wm_self
    JOIN public.workspace_members wm_owner
      ON wm_owner.workspace_id = wm_self.workspace_id
    WHERE wm_self.user_id = auth.uid()
      AND wm_owner.user_id = ((storage.foldername(name))[1])::uuid
  )
);
