
-- 1. content_titles INSERT: allow locked = false (UI default) or NULL for owners
DROP POLICY IF EXISTS ct_insert_owner_or_admin ON public.content_titles;
CREATE POLICY ct_insert_owner_or_admin ON public.content_titles
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_super_admin(auth.uid())
  OR (
    owner_user_id = auth.uid()
    AND status = 'draft'::content_status
    AND approved_at IS NULL
    AND approved_by IS NULL
    AND published_at IS NULL
    AND published_by IS NULL
    AND (locked IS NULL OR locked = false)
  )
);

-- 2. enforce_onboarding_pricing: never revert terminal payment_status on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_onboarding_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cycle text := lower(coalesce(NEW.selected_cycle, ''));
  v_base numeric;
  v_promo text := NEW.promo_code;
  v_terminal_statuses text[] := ARRAY['paid','captured','refunded','failed','cancelled','complete','completed'];
BEGIN
  v_base := CASE v_cycle
    WHEN 'free'    THEN 0
    WHEN 'creator' THEN 650
    WHEN 'topup'   THEN 650
    ELSE NULL
  END;

  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Invalid selected_cycle: %', NEW.selected_cycle
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.base_price := v_base;

  IF v_promo IS NULL THEN
    NEW.final_price := v_base;
  ELSIF v_promo = 'INDUSTRY100' THEN
    NEW.final_price := 0;
  ELSE
    RAISE EXCEPTION 'Unknown or unsupported promo_code: %', v_promo
      USING ERRCODE = 'check_violation';
  END IF;

  -- Only set payment_status on INSERT, or when it is currently NULL/pending.
  -- Never overwrite a terminal status set by a payment webhook.
  IF TG_OP = 'INSERT' THEN
    IF NEW.payment_status IS NULL OR NEW.payment_status NOT IN (SELECT unnest(v_terminal_statuses)) THEN
      IF v_promo = 'INDUSTRY100' OR v_base = 0 THEN
        NEW.payment_status := 'free';
      ELSE
        NEW.payment_status := 'pending';
      END IF;
    END IF;
  ELSE
    -- On UPDATE: preserve terminal payment_status; only normalize if still pending/null
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
       AND OLD.payment_status IS NOT NULL
       AND OLD.payment_status IN (SELECT unnest(v_terminal_statuses)) THEN
      -- Attempted revert: keep the terminal value
      NEW.payment_status := OLD.payment_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. get_workspace_storage: drop the stray `extra_param` overload
DROP FUNCTION IF EXISTS public.get_workspace_storage(uuid, boolean);

-- 4. Grants for authenticated callers on user-facing RPCs
GRANT EXECUTE ON FUNCTION public.claim_legacy_films() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_failure_counts(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_distribution_partners() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_workspace_storage_entitlement(uuid) TO authenticated;
