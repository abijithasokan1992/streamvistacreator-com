
CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  base   text := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/';
BEGIN
  SELECT net.http_post(
    url     := base || fn_name,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  ) INTO req_id;
  RETURN req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_edge_function(text) FROM PUBLIC, anon, authenticated;
