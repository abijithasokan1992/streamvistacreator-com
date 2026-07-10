
-- 1) Repair the lock-guard trigger so DELETE proceeds
CREATE OR REPLACE FUNCTION public.content_titles_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.locked = true
     AND NOT (public.has_role(auth.uid(),'admin'::public.app_role)
              OR public.is_super_admin(auth.uid())
              OR OLD.owner_user_id = auth.uid())
  THEN
    RAISE EXCEPTION 'Title is locked' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $function$;

-- 2) C2: remove obvious demo/test titles
DELETE FROM public.content_titles
 WHERE id IN (
   '4fca3906-7f44-43f9-8c5a-473887db6a97',
   '69c3f3e4-cefb-4ea2-aa84-4758d1dd2f6e',
   '96d9b78b-b467-4268-9eb5-635fa85aca7d',
   '86d16d00-9d6e-4a32-a53e-d9319eeb05f2',
   '4073fb90-d555-4932-b616-bf948a11b3b5',
   'fdb75f9b-650a-4ab2-b24b-04a1456cac52',
   'b50eb3fb-8085-41f3-ab65-7fc1cacf1f92',
   '67d762b4-a844-4293-bf96-0e0a57465d42',
   '88d4c5f6-10b3-4d90-adb0-a09a90b81695',
   '3abd1a07-b078-42fd-9da2-1dd03df8989d'
 );

-- 3) C3: remove the single demo workspace
DELETE FROM public.workspace_members WHERE workspace_id = 'a98dbd79-0ef3-4fa1-ab59-74557fecbddf';
DELETE FROM public.workspaces        WHERE id           = 'a98dbd79-0ef3-4fa1-ab59-74557fecbddf';
