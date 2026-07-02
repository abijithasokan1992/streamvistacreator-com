
-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 1: Premium-storage RLS gates for paid Studio / vault operations.
-- Workspace admins must already have an active paid storage entitlement
-- (creator_payg block, studio vault block, or admin bonus) to *create* one of
-- these jobs. Reads stay unrestricted within the workspace so historic jobs
-- remain visible on the free tier.
-- ─────────────────────────────────────────────────────────────────────────────

-- archive_jobs: tighten INSERT
DROP POLICY IF EXISTS "Members can request archive jobs" ON public.archive_jobs;
CREATE POLICY "Premium members can request archive jobs"
  ON public.archive_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_premium_storage_entitlement(auth.uid())
    )
  );

-- restore_jobs: tighten INSERT
DROP POLICY IF EXISTS "Members can request restore jobs" ON public.restore_jobs;
CREATE POLICY "Premium members can request restore jobs"
  ON public.restore_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_premium_storage_entitlement(auth.uid())
    )
  );

-- ingest_jobs: tighten INSERT (Studio Ingest / Crayons Bridge)
DROP POLICY IF EXISTS "Members can create ingest jobs" ON public.ingest_jobs;
CREATE POLICY "Premium members can create ingest jobs"
  ON public.ingest_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_workspace_admin(workspace_id, auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_premium_storage_entitlement(auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Canonical price helper — single source of truth for any code that needs
-- the Creator Pay-As-You-Go price. Reads directly from the active plan row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_canonical_payg_price()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan_code',       p.code,
    'currency',        p.currency,
    'storage_gb',      p.storage_gb,
    'base_inr',        p.price_amount,
    'gst_percent',     p.gst_percent,
    'total_inr',       ROUND(p.price_amount * (1 + p.gst_percent / 100.0), 2),
    'base_paise',      ROUND(p.price_amount * 100)::bigint,
    'gst_paise',       ROUND(p.price_amount * p.gst_percent)::bigint,
    'total_paise',     ROUND(p.price_amount * (100 + p.gst_percent))::bigint,
    'billing_cycle',   p.billing_cycle,
    'is_active',       p.is_active
  )
  FROM public.plans p
  WHERE p.code = 'creator_payg_1tb'
    AND p.is_active = true
    AND p.is_archived = false
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_canonical_payg_price() TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: every existing storage entitlement gets a matching plan_assignment
-- so the commercial trail is complete and auditable. Only inserts rows where
-- one doesn't already exist (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.plan_assignments (user_id, plan_id, status, starts_at, is_lifetime, notes)
SELECT
  e.user_id,
  p.id,
  'active'::plan_assignment_status,
  COALESCE(e.effective_from, now()),
  true,
  'backfill: default Creator Basic free tier'
FROM public.workspace_storage_entitlements e
JOIN public.plans p ON p.code = e.plan_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.plan_assignments a
   WHERE a.user_id = e.user_id
     AND a.plan_id = p.id
     AND a.status = 'active'
);

-- Make sure every entitlement explicitly carries source + grant_reason
UPDATE public.workspace_storage_entitlements
SET source = 'default_free',
    grant_reason = COALESCE(grant_reason, 'Auto-provisioned Creator Basic on signup (backfilled)')
WHERE source IS NULL OR grant_reason IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Canonical free-tier policy note (commercial truth: lifetime, 5 GB workspace).
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE public.free_tier_config IS
  'Canonical free-tier policy for Creator Basic. Lifetime (duration_days = 0 means no expiry). 5 GB workspace, 500 GB monthly bandwidth, ₹10/GB overage. Single source of truth — UI and edge functions must read from here or from the plans.creator_basic row, never hardcode.';
