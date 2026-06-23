
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

  -- Never reassign or strip protected/invite-only roles via this path.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = uid
      AND role IN (
        'admin','super_admin',
        'qc_reviewer','legal_reviewer',
        'localization_partner','distributor'
      )
  ) THEN
    RETURN false;
  END IF;

  -- MVP public signup whitelist.
  IF _role NOT IN ('content_owner','studio','buyer') THEN
    RETURN false;
  END IF;

  target := _role::public.app_role;

  DELETE FROM public.user_roles
    WHERE user_id = uid
      AND role NOT IN (
        'admin','super_admin',
        'qc_reviewer','legal_reviewer',
        'localization_partner','distributor'
      )
      AND role <> target;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, target)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_initial_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_initial_role(text) TO service_role;

CREATE OR REPLACE FUNCTION public.is_qc_reviewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'qc_reviewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_legal_reviewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'legal_reviewer'
  );
$$;

REVOKE ALL ON FUNCTION public.is_qc_reviewer(uuid)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_legal_reviewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_qc_reviewer(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_legal_reviewer(uuid) TO authenticated, service_role;
