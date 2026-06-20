
DROP VIEW IF EXISTS public.payment_security_events;

CREATE VIEW public.payment_security_events
WITH (security_invoker = true) AS
SELECT
  id, created_at, severity, action_type, source,
  user_id, order_id, payment_id, event_id,
  error_message, duration_ms, extra,
  CASE
    WHEN action_type = 'webhook.signature' AND severity='ERROR' THEN 'invalid_signature'
    WHEN action_type = 'webhook.replay_skipped'                 THEN 'duplicate_event'
    WHEN action_type = 'webhook.replay_attempt'                 THEN 'replay_attempt'
    WHEN action_type = 'webhook.idempotency_conflict'           THEN 'idempotency_conflict'
    WHEN action_type = 'entitlement.projection_failed'          THEN 'entitlement_projection_failure'
    WHEN action_type = 'subscription.mapping_failed'            THEN 'subscription_mapping_failure'
    WHEN action_type = 'invoice.mismatch'                       THEN 'invoice_mismatch'
    WHEN action_type = 'payment.amount_mismatch'                THEN 'amount_mismatch'
    WHEN action_type = 'webhook.parse_failed'                   THEN 'webhook_parse_failure'
    WHEN action_type = 'payment.unknown_mapping'                THEN 'unknown_payment_mapping'
    ELSE NULL
  END AS event_category
FROM public.payment_debug_logs
WHERE action_type IN (
  'webhook.signature',
  'webhook.replay_skipped',
  'webhook.replay_attempt',
  'webhook.idempotency_conflict',
  'entitlement.projection_failed',
  'subscription.mapping_failed',
  'invoice.mismatch',
  'payment.amount_mismatch',
  'webhook.parse_failed',
  'payment.unknown_mapping'
);

GRANT SELECT ON public.payment_security_events TO authenticated;
GRANT SELECT ON public.payment_security_events TO service_role;
