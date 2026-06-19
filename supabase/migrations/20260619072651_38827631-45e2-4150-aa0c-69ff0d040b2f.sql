
-- 1. Replace is_super_admin to rely solely on the super_admin role.
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL
    AND public.has_role(_user_id, 'super_admin'::public.app_role);
$function$;

-- 2. Seed the previously hardcoded super admin into user_roles so access is preserved.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'abijithasokan@crayonspictures.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Remove the broad workspace-member read policy on recent_uploads.
DROP POLICY IF EXISTS "Workspace members read uploads" ON public.recent_uploads;
