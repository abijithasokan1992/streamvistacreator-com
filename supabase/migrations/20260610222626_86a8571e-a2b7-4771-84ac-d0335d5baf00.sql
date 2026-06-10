-- Validation trigger: any INSERT/UPDATE that lands razorpay_config in 'live'
-- mode must carry a production-shaped key_id. Secrets (key_secret, webhook_secret)
-- live in env vars and are validated by validate_razorpay_live_secrets() below,
-- which the razorpay-admin edge function calls before flipping mode to 'live'.
CREATE OR REPLACE FUNCTION public.validate_razorpay_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  IF NEW.mode = 'live' THEN
    k := COALESCE(NEW.key_id, '');

    IF length(k) = 0 THEN
      RAISE EXCEPTION 'Razorpay Live mode requires Key ID' USING ERRCODE = '22023';
    END IF;

    IF k ~ '\s' THEN
      RAISE EXCEPTION 'Razorpay Key ID must not contain whitespace' USING ERRCODE = '22023';
    END IF;

    IF k NOT LIKE 'rzp_live_%' THEN
      RAISE EXCEPTION 'Razorpay Live mode requires a Key ID starting with rzp_live_' USING ERRCODE = '22023';
    END IF;

    -- Production key IDs are ~24 chars; reject anything obviously truncated.
    IF length(k) < 20 THEN
      RAISE EXCEPTION 'Razorpay Key ID is too short to be a valid production key' USING ERRCODE = '22023';
    END IF;

    -- Reject common placeholder patterns admins paste by accident.
    IF lower(k) ~ '(your[_-]?key|changeme|placeholder|xxxx|example|test[_-]?key|todo)' THEN
      RAISE EXCEPTION 'Razorpay Key ID looks like a placeholder, not a real production key' USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS razorpay_config_validate ON public.razorpay_config;
CREATE TRIGGER razorpay_config_validate
BEFORE INSERT OR UPDATE ON public.razorpay_config
FOR EACH ROW EXECUTE FUNCTION public.validate_razorpay_config();

-- Admin-only helper: validates a Key Secret + Webhook Secret pair against
-- production-grade rules (no whitespace, sufficient length/entropy, no
-- placeholder text). Returns a structured result the edge function can use
-- to refuse the mode flip before writing to razorpay_config.
CREATE OR REPLACE FUNCTION public.validate_razorpay_live_secrets(
  _key_secret text,
  _webhook_secret text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  errs text[] := ARRAY[]::text[];
  ks text := COALESCE(_key_secret, '');
  ws text := COALESCE(_webhook_secret, '');
  distinct_ks int;
  distinct_ws int;
BEGIN
  -- Only admins may call this.
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF length(ks) = 0 THEN
    errs := array_append(errs, 'Key Secret is required for Live mode');
  ELSE
    IF ks ~ '\s' THEN errs := array_append(errs, 'Key Secret must not contain whitespace'); END IF;
    IF length(ks) < 20 THEN errs := array_append(errs, 'Key Secret is too short for production'); END IF;
    IF lower(ks) ~ '(your[_-]?secret|changeme|placeholder|xxxx|example|test[_-]?secret|todo|secret123)' THEN
      errs := array_append(errs, 'Key Secret looks like a placeholder');
    END IF;
    SELECT COUNT(DISTINCT c) INTO distinct_ks FROM regexp_split_to_table(ks, '') AS c;
    IF distinct_ks < 8 THEN errs := array_append(errs, 'Key Secret has insufficient entropy'); END IF;
  END IF;

  IF length(ws) = 0 THEN
    errs := array_append(errs, 'Webhook Secret is required for Live mode');
  ELSE
    IF ws ~ '\s' THEN errs := array_append(errs, 'Webhook Secret must not contain whitespace'); END IF;
    IF length(ws) < 20 THEN errs := array_append(errs, 'Webhook Secret is too short for production'); END IF;
    IF lower(ws) ~ '(your[_-]?secret|changeme|placeholder|xxxx|example|webhook[_-]?secret[_-]?here|todo)' THEN
      errs := array_append(errs, 'Webhook Secret looks like a placeholder');
    END IF;
    SELECT COUNT(DISTINCT c) INTO distinct_ws FROM regexp_split_to_table(ws, '') AS c;
    IF distinct_ws < 8 THEN errs := array_append(errs, 'Webhook Secret has insufficient entropy'); END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', array_length(errs, 1) IS NULL,
    'errors', to_jsonb(errs)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_razorpay_live_secrets(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.validate_razorpay_live_secrets(text, text) TO authenticated, service_role;