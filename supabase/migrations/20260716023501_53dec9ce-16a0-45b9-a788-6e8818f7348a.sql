-- Harden distribution_partners: remove broad authenticated read access.
-- Sensitive columns (contact_email, config) are no longer exposed to non-admin
-- authenticated users. Non-admins must go through the SECURITY DEFINER RPC
-- `list_active_distribution_partners`, which returns only safe columns.

DROP POLICY IF EXISTS "Authenticated read active partners" ON public.distribution_partners;

-- Ensure admin-only SELECT/manage policies remain (no-op if already present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distribution_partners' AND policyname = 'admins read partners'
  ) THEN
    EXECUTE $p$CREATE POLICY "admins read partners" ON public.distribution_partners
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role))$p$;
  END IF;
END $$;

-- Belt-and-suspenders: revoke table-level SELECT from authenticated so that
-- even if a permissive policy is re-introduced by mistake, sensitive columns
-- stay locked to service_role/admin paths.
REVOKE SELECT ON public.distribution_partners FROM authenticated;
GRANT SELECT ON public.distribution_partners TO service_role;