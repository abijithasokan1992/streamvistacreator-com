
UPDATE public.plans
   SET is_active = false, is_archived = true, visibility = 'hidden',
       description = 'Deprecated — superseded by creator_basic (5 GB lifetime).',
       updated_at = now()
 WHERE code = 'free';

INSERT INTO public.plans (
  code, name, description, role, currency, price_amount, gst_percent,
  billing_cycle, storage_gb, bandwidth_gb, user_limit, trial_days,
  features, is_active, is_archived, visibility, sort_order, topup_unit_tb
) VALUES (
  'creator_basic', 'Creator Basic',
  'Submission & evaluation plan. 5 GB workspace · 1 active title · lifetime free. Add 1 TB storage blocks anytime.',
  'content_owner', 'INR', 0, 0, 'lifetime', 5, 500, 1, 0,
  '["5 GB workspace","1 active title","Post-submission title lock","Lightweight rights intake","Stackable 1 TB add-on blocks"]'::jsonb,
  true, false, 'public', 0, 1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  storage_gb = 5, bandwidth_gb = 500, billing_cycle = 'lifetime',
  price_amount = 0, is_active = true, is_archived = false,
  visibility = 'public', features = EXCLUDED.features, updated_at = now();

UPDATE public.plans
   SET name = 'Creator · +1 TB Storage Block',
       description = 'Recurring 1 TB storage add-on. ₹650 base + 18% GST = ₹767/month. Stack multiple blocks. Cancel at end of cycle.',
       price_amount = 650, gst_percent = 18, billing_cycle = 'monthly',
       storage_gb = 1024, topup_unit_tb = 1, visibility = 'public',
       is_active = true, is_archived = false, sort_order = 10, updated_at = now()
 WHERE code = 'creator_payg_1tb';

UPDATE public.free_tier_config
   SET storage_gb = 5, duration_days = 0, bandwidth_gb = 500,
       label = 'Creator Basic',
       notes = 'Lifetime free tier (duration_days=0 means no expiry) · 5 GB workspace · 500 GB monthly bandwidth.',
       updated_at = now();

ALTER TABLE public.workspace_storage_entitlements
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'default_free',
  ADD COLUMN IF NOT EXISTS grant_reason text,
  ADD COLUMN IF NOT EXISTS granted_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workspace_storage_entitlements_source_chk') THEN
    ALTER TABLE public.workspace_storage_entitlements
      ADD CONSTRAINT workspace_storage_entitlements_source_chk
      CHECK (source IN ('default_free','paid_subscription','paid_topup','admin_bonus','promotional','legacy_migrated'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS workspace_storage_entitlements_source_idx
  ON public.workspace_storage_entitlements(source);

-- Backfill — do NOT touch generated total_storage_gb
UPDATE public.workspace_storage_entitlements
   SET source = 'default_free',
       grant_reason = COALESCE(grant_reason, 'Auto-provisioned Creator Basic on signup'),
       plan_code = 'creator_basic',
       included_storage_gb = 5,
       updated_at = now()
 WHERE (plan_code IN ('creator_basic','free') OR plan_code IS NULL)
   AND COALESCE(paid_storage_gb, 0) = 0
   AND COALESCE(admin_bonus_storage_gb, 0) = 0;

CREATE OR REPLACE FUNCTION public.has_premium_storage_entitlement(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_storage_entitlements
     WHERE user_id = _user_id
       AND billing_status IN ('ok','warning','urgent')
       AND (
         COALESCE(paid_storage_gb, 0) > 0
         OR COALESCE(admin_bonus_storage_gb, 0) > 0
         OR source IN ('paid_subscription','paid_topup','admin_bonus','promotional')
       )
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_premium_storage_entitlement(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "admins manage alert rules" ON public.ingest_alert_rules;
DROP POLICY IF EXISTS "members read alert rules" ON public.ingest_alert_rules;

CREATE POLICY "alert rules read"
  ON public.ingest_alert_rules FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_workspace_admin(auth.uid(), workspace_id)
    OR EXISTS (SELECT 1 FROM public.workspace_members wm
                WHERE wm.workspace_id = ingest_alert_rules.workspace_id
                  AND wm.user_id = auth.uid())
  );

CREATE POLICY "alert rules insert premium"
  ON public.ingest_alert_rules FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (is_workspace_admin(auth.uid(), workspace_id)
        AND public.has_premium_storage_entitlement(auth.uid()))
  );

CREATE POLICY "alert rules update premium"
  ON public.ingest_alert_rules FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR (is_workspace_admin(auth.uid(), workspace_id)
        AND public.has_premium_storage_entitlement(auth.uid()))
  );

CREATE POLICY "alert rules delete"
  ON public.ingest_alert_rules FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_workspace_admin(auth.uid(), workspace_id)
  );
