DROP POLICY IF EXISTS "Users insert own frontend telemetry" ON public.payment_debug_logs;
CREATE POLICY "Users insert own frontend telemetry"
ON public.payment_debug_logs
FOR INSERT
TO authenticated
WITH CHECK (
  source = 'frontend'
  AND user_id = auth.uid()
  AND severity = ANY (ARRAY['INFO','WARN','ERROR'])
  AND payment_id IS NULL
  AND order_id IS NULL
  AND event_id IS NULL
);