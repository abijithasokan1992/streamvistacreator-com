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
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  -- Existing protected roles are never reassigned via this client-callable path.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role IN ('admin','super_admin','localization_partner','distributor')
  ) THEN
    RETURN false;
  END IF;

  -- Public signup whitelist only. Legacy roles are never assigned moving forward.
  IF _role NOT IN ('content_owner','studio','buyer') THEN
    RETURN false;
  END IF;

  target := _role::public.app_role;

  -- Replace any other non-protected role with the explicitly chosen public role.
  DELETE FROM public.user_roles
    WHERE user_id = uid
      AND role NOT IN ('admin','super_admin','localization_partner','distributor')
      AND role <> target;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, target)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_initial_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO authenticated;