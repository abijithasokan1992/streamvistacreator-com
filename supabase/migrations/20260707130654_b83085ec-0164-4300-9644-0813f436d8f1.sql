-- Replace the no-op tautology WITH CHECK on inviter UPDATE with a trigger
-- that blocks changes to protected columns. RLS WITH CHECK cannot reference
-- OLD, so we enforce column-level immutability via a BEFORE UPDATE trigger.

DROP POLICY IF EXISTS "Inviters can update their intro invites" ON public.intro_invites;
CREATE POLICY "Inviters can update their intro invites"
  ON public.intro_invites
  FOR UPDATE
  TO authenticated
  USING (inviter_user_id = auth.uid())
  WITH CHECK (inviter_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.intro_invites_freeze_protected_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass the freeze
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.inviter_user_id IS DISTINCT FROM OLD.inviter_user_id
     OR NEW.invite_code IS DISTINCT FROM OLD.invite_code
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.accepted_user_id IS DISTINCT FROM OLD.accepted_user_id THEN
    RAISE EXCEPTION 'intro_invites: protected fields cannot be modified by inviter';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intro_invites_freeze_protected ON public.intro_invites;
CREATE TRIGGER trg_intro_invites_freeze_protected
  BEFORE UPDATE ON public.intro_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.intro_invites_freeze_protected_cols();
