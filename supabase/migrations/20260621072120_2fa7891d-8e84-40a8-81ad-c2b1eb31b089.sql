
CREATE TABLE IF NOT EXISTS public.payment_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  payment_id text,
  user_id uuid,
  source text,
  topup_id uuid,
  amount_paise bigint,
  currency text,
  razorpay_order_status text,
  razorpay_payment_status text,
  frontend_state text,
  webhook_event text,
  webhook_signature_valid boolean,
  invoice_id uuid,
  invoice_created boolean NOT NULL DEFAULT false,
  allocation_created boolean NOT NULL DEFAULT false,
  final_result text,
  last_error text,
  order_created_at timestamptz NOT NULL DEFAULT now(),
  checkout_opened_at timestamptz,
  payment_completed_at timestamptz,
  verify_started_at timestamptz,
  verify_completed_at timestamptz,
  webhook_received_at timestamptz,
  entitlement_started_at timestamptz,
  entitlement_completed_at timestamptz,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_traces TO authenticated;
GRANT ALL ON public.payment_traces TO service_role;

ALTER TABLE public.payment_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all payment traces" ON public.payment_traces
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_payment_traces_created_at ON public.payment_traces (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_traces_user_id ON public.payment_traces (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_traces_final_result ON public.payment_traces (final_result);

-- Append-style upsert: merges a JSON patch into the trace row, only writing
-- columns the caller has provided. Used by edge functions (service role) and
-- the authenticated frontend (via the RPC below).
CREATE OR REPLACE FUNCTION public.payment_trace_upsert(
  p_order_id text,
  p_patch jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_order_id IS NULL OR length(p_order_id) = 0 THEN
    RAISE EXCEPTION 'order_id required';
  END IF;

  INSERT INTO public.payment_traces (order_id, extra)
    VALUES (p_order_id, '{}'::jsonb)
  ON CONFLICT (order_id) DO NOTHING;

  UPDATE public.payment_traces SET
    payment_id              = COALESCE(p_patch->>'payment_id', payment_id),
    user_id                 = COALESCE(NULLIF(p_patch->>'user_id','')::uuid, user_id),
    source                  = COALESCE(p_patch->>'source', source),
    topup_id                = COALESCE(NULLIF(p_patch->>'topup_id','')::uuid, topup_id),
    amount_paise            = COALESCE((p_patch->>'amount_paise')::bigint, amount_paise),
    currency                = COALESCE(p_patch->>'currency', currency),
    razorpay_order_status   = COALESCE(p_patch->>'razorpay_order_status', razorpay_order_status),
    razorpay_payment_status = COALESCE(p_patch->>'razorpay_payment_status', razorpay_payment_status),
    frontend_state          = COALESCE(p_patch->>'frontend_state', frontend_state),
    webhook_event           = COALESCE(p_patch->>'webhook_event', webhook_event),
    webhook_signature_valid = COALESCE((p_patch->>'webhook_signature_valid')::boolean, webhook_signature_valid),
    invoice_id              = COALESCE(NULLIF(p_patch->>'invoice_id','')::uuid, invoice_id),
    invoice_created         = COALESCE((p_patch->>'invoice_created')::boolean, invoice_created),
    allocation_created      = COALESCE((p_patch->>'allocation_created')::boolean, allocation_created),
    final_result            = COALESCE(p_patch->>'final_result', final_result),
    last_error              = COALESCE(p_patch->>'last_error', last_error),
    checkout_opened_at      = COALESCE((p_patch->>'checkout_opened_at')::timestamptz, checkout_opened_at),
    payment_completed_at    = COALESCE((p_patch->>'payment_completed_at')::timestamptz, payment_completed_at),
    verify_started_at       = COALESCE((p_patch->>'verify_started_at')::timestamptz, verify_started_at),
    verify_completed_at     = COALESCE((p_patch->>'verify_completed_at')::timestamptz, verify_completed_at),
    webhook_received_at     = COALESCE((p_patch->>'webhook_received_at')::timestamptz, webhook_received_at),
    entitlement_started_at  = COALESCE((p_patch->>'entitlement_started_at')::timestamptz, entitlement_started_at),
    entitlement_completed_at= COALESCE((p_patch->>'entitlement_completed_at')::timestamptz, entitlement_completed_at),
    extra                   = extra || COALESCE(p_patch->'extra', '{}'::jsonb),
    updated_at              = now()
  WHERE order_id = p_order_id
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.payment_trace_upsert(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.payment_trace_upsert(text, jsonb) TO service_role;

-- Authenticated frontend RPC: lets the buyer log their own client-side events
-- (checkout opened, payment success callback) but only against their own order.
CREATE OR REPLACE FUNCTION public.record_payment_trace_event(
  p_order_id text,
  p_event text,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_patch jsonb := '{}'::jsonb;
  v_now text := now()::text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_order_id IS NULL OR length(p_order_id) = 0 THEN
    RAISE EXCEPTION 'order_id required';
  END IF;

  SELECT user_id INTO v_owner FROM public.payment_traces WHERE order_id = p_order_id;
  -- Owner must match if known; if unknown (race) we'll record and let the
  -- edge-function-side upsert reconcile user_id.
  IF v_owner IS NOT NULL AND v_owner <> v_uid AND NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_patch := jsonb_build_object('extra', p_extra, 'user_id', v_uid::text);

  IF p_event = 'checkout_opened' THEN
    v_patch := v_patch || jsonb_build_object('checkout_opened_at', v_now, 'frontend_state', 'checkout_open');
  ELSIF p_event = 'payment_success_callback' THEN
    v_patch := v_patch || jsonb_build_object(
      'payment_completed_at', v_now,
      'frontend_state', 'payment_success_callback',
      'payment_id', p_extra->>'payment_id'
    );
  ELSIF p_event = 'checkout_dismissed' THEN
    v_patch := v_patch || jsonb_build_object('frontend_state', 'checkout_dismissed');
  ELSIF p_event = 'payment_failed' THEN
    v_patch := v_patch || jsonb_build_object(
      'frontend_state', 'payment_failed',
      'last_error', p_extra->>'message'
    );
  ELSIF p_event = 'frontend_state' THEN
    v_patch := v_patch || jsonb_build_object('frontend_state', p_extra->>'state');
  ELSE
    RAISE EXCEPTION 'unknown event: %', p_event;
  END IF;

  PERFORM public.payment_trace_upsert(p_order_id, v_patch);
END;
$$;

REVOKE ALL ON FUNCTION public.record_payment_trace_event(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_trace_event(text, text, jsonb) TO authenticated;
