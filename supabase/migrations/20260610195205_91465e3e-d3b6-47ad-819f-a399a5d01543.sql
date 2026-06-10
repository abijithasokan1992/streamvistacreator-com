
DO $$
DECLARE
  sole_admin uuid;
BEGIN
  SELECT id INTO sole_admin FROM auth.users
   WHERE lower(email) = 'abijithasokan@crayonspictures.com'
   LIMIT 1;

  IF sole_admin IS NULL THEN
    RAISE EXCEPTION 'User abijithasokan@crayonspictures.com not found in auth.users — sign up first, then re-run.';
  END IF;

  -- Ensure this user has admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (sole_admin, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Revoke admin from everyone else
  DELETE FROM public.user_roles
   WHERE role = 'admin' AND user_id <> sole_admin;
END $$;
