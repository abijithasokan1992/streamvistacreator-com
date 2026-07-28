REVOKE EXECUTE ON FUNCTION public.import_revenue_statement(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_revenue_statement(jsonb) TO authenticated, service_role;