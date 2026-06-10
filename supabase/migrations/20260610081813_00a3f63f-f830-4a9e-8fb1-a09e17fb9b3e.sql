
-- 1. Extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Razorpay recurring tokens (nullable; populated when user authorises mandate)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS razorpay_customer_id text,
  ADD COLUMN IF NOT EXISTS razorpay_token_id text;

-- 3. Turn the master switch ON so charge-overages actually charges
UPDATE public.billing_config SET auto_charge_enabled = true, updated_at = now() WHERE id = 1;
INSERT INTO public.billing_config (id, auto_charge_enabled)
  SELECT 1, true WHERE NOT EXISTS (SELECT 1 FROM public.billing_config WHERE id = 1);

-- 4. Helper to invoke an edge function from cron via pg_net
CREATE OR REPLACE FUNCTION public.invoke_edge_function(fn_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id bigint;
  base   text := 'https://hllgmkfqgeuqlmpcirvn.supabase.co/functions/v1/';
  key    text := current_setting('app.service_role_key', true);
BEGIN
  SELECT net.http_post(
    url     := base || fn_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(key, '')
    ),
    body    := '{}'::jsonb
  ) INTO req_id;
  RETURN req_id;
END;
$$;

-- 5. Unschedule any prior versions so this migration is idempotent
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname IN
    ('streamvista-track-usage','streamvista-charge-overages','streamvista-reclaim-idle')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- 6. Schedule the three pipelines
SELECT cron.schedule('streamvista-track-usage',     '7 * * * *',  $$SELECT public.invoke_edge_function('track-usage');$$);
SELECT cron.schedule('streamvista-charge-overages', '17 * * * *', $$SELECT public.invoke_edge_function('charge-overages');$$);
SELECT cron.schedule('streamvista-reclaim-idle',    '30 3 * * *', $$SELECT public.invoke_edge_function('reclaim-idle');$$);
