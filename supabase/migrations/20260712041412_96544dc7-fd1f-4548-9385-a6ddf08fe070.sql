REVOKE ALL ON FUNCTION public.title_removal_preflight(uuid)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.title_request_archive(uuid, text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.title_request_permanent_removal(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_removal_approve(uuid, text)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_removal_reject(uuid, text)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_removal_cancel(uuid, text)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.storage_recalc_enqueue(uuid, uuid, text)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.title_removal_preflight(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.title_request_archive(uuid, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.title_request_permanent_removal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_removal_approve(uuid, text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_removal_reject(uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_removal_cancel(uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_recalc_enqueue(uuid, uuid, text)   TO authenticated;
