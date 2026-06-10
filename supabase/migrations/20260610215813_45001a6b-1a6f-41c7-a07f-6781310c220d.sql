CREATE OR REPLACE FUNCTION public.set_initial_role(_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  target public.app_role;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Admins are never reassigned via this client-callable path.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'admin') THEN
    RETURN false;
  END IF;

  -- Whitelist: never grant admin from the client.
  IF _role NOT IN ('creator','executive_producer','client') THEN
    RETURN false;
  END IF;

  target := _role::public.app_role;

  -- Replace the default role assigned by assign_default_role with the chosen one.
  DELETE FROM public.user_roles
    WHERE user_id = uid AND role <> 'admin' AND role <> target;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, target)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_initial_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO authenticated;
