DROP TRIGGER IF EXISTS on_auth_user_assign_default_role ON auth.users;

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Deprecated: roles are now assigned via public.set_initial_role()
  -- called from the auth callback based on the user's explicit selection.
  -- Kept as a no-op so any lingering references do not error.
  RETURN NEW;
END;
$function$;