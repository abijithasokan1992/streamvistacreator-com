
CREATE OR REPLACE FUNCTION public.set_initial_role(_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  target public.app_role;
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;

  -- Existing admins are never reassigned via this client-callable path.
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid AND role IN ('admin','super_admin')) THEN
    RETURN false;
  END IF;

  -- Public signup whitelist. Invite-only roles (admin, super_admin,
  -- localization_partner, distributor) are NEVER granted from the client.
  IF _role NOT IN ('content_owner','studio','buyer','creator','executive_producer','client') THEN
    RETURN false;
  END IF;

  target := _role::public.app_role;

  -- Replace any other non-admin role with the chosen one.
  DELETE FROM public.user_roles
    WHERE user_id = uid
      AND role NOT IN ('admin','super_admin')
      AND role <> target;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, target)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;
