
-- Paddle customer mirror + scheduled change columns for entitlement helper.

CREATE TABLE IF NOT EXISTS public.paddle_customers (
  customer_id text PRIMARY KEY,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.paddle_customers TO authenticated;
GRANT ALL ON public.paddle_customers TO service_role;

ALTER TABLE public.paddle_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own paddle customer" ON public.paddle_customers;
CREATE POLICY "Users see their own paddle customer"
  ON public.paddle_customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS paddle_customers_user_id_idx ON public.paddle_customers(user_id);
CREATE INDEX IF NOT EXISTS paddle_customers_email_idx ON public.paddle_customers(lower(email));

-- Scheduled change fields on subscriptions (grace-period aware).
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_change_action text,
  ADD COLUMN IF NOT EXISTS scheduled_change_at timestamptz;
