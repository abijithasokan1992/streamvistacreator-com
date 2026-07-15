CREATE OR REPLACE FUNCTION public.can_view_entity_profile(_kind text, _user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (_kind = 'creator' AND _user_id = auth.uid())
    OR (
      _kind IN ('studio','buyer')
      AND _org_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = _org_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner','admin')
      )
    );
$function$;