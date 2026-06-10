-- Fix referrals: authenticated users can only read their own referral data
CREATE POLICY "Users can read own referrals"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = referrer_user_id
    OR auth.uid() = referred_user_id
  );

-- Fix mcp_audit_log: remove overly permissive INSERT policy for authenticated users
DROP POLICY IF EXISTS "Authenticated users can insert MCP audit entries"
  ON public.mcp_audit_log;

-- Replace with strict service_role-only INSERT policy
CREATE POLICY "Service role can insert MCP audit entries"
  ON public.mcp_audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);