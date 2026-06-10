DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'producer_assignments_ep_creator_unique'
  ) THEN
    ALTER TABLE public.producer_assignments
    ADD CONSTRAINT producer_assignments_ep_creator_unique
    UNIQUE (ep_user_id, creator_user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.request_creator_link(_creator_email TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ep_id UUID := auth.uid();
  _creator_id UUID;
BEGIN
  IF _ep_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify requester is an executive_producer
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _ep_id AND role = 'executive_producer'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Find creator by email
  SELECT id INTO _creator_id
  FROM auth.users
  WHERE email = lower(trim(_creator_email));

  IF _creator_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify target user has creator role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _creator_id AND role = 'creator'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Prevent self-linking
  IF _creator_id = _ep_id THEN
    RETURN FALSE;
  END IF;

  -- Insert assignment (idempotent)
  INSERT INTO public.producer_assignments (ep_user_id, creator_user_id)
  VALUES (_ep_id, _creator_id)
  ON CONFLICT ON CONSTRAINT producer_assignments_ep_creator_unique DO NOTHING;

  RETURN TRUE;
END;
$$;