-- ============================================================================
-- Phase D2A — Revenue Statement Import (PENDING, NOT EXECUTED)
--
-- Reason: The existing `revenue_imports` / `revenue_lines` tables can
-- represent core amounts but lack typed fields for statement idempotency,
-- per-row idempotency, tax / gateway / in-app charges, commercial model, and
-- workspace scoping. This migration adds them idempotently without touching
-- historical rows and without any destructive SQL.
--
-- Preflight (comment only, do not execute here):
--   -- rows to backfill: SELECT count(*) FROM public.revenue_imports WHERE (notes ILIKE 'sk=%');
--   -- rows already using metadata.statement_key: SELECT count(*) FROM public.revenue_lines
--   --   WHERE metadata ? 'statement_key';
-- ============================================================================

BEGIN;

-- ---------- revenue_imports: typed idempotency + workspace ----------------
ALTER TABLE public.revenue_imports
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_statement_id text,
  ADD COLUMN IF NOT EXISTS statement_key text,
  ADD COLUMN IF NOT EXISTS commercial_model text,
  ADD COLUMN IF NOT EXISTS tax_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_app_fee_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount_paise bigint NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS revenue_imports_statement_key_uidx
  ON public.revenue_imports(statement_key)
  WHERE statement_key IS NOT NULL;

-- ---------- revenue_lines: typed extensions + per-row idempotency ---------
ALTER TABLE public.revenue_lines
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS row_key text,
  ADD COLUMN IF NOT EXISTS statement_key text,
  ADD COLUMN IF NOT EXISTS source_row_index integer,
  ADD COLUMN IF NOT EXISTS commercial_model text,
  ADD COLUMN IF NOT EXISTS tax_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gateway_fee_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_app_fee_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS creator_share_paise bigint,
  ADD COLUMN IF NOT EXISTS platform_share_paise bigint,
  ADD COLUMN IF NOT EXISTS raw_row jsonb,
  ADD COLUMN IF NOT EXISTS source_statement_id text;

CREATE UNIQUE INDEX IF NOT EXISTS revenue_lines_row_key_uidx
  ON public.revenue_lines(row_key)
  WHERE row_key IS NOT NULL;

-- Guard rails: share_rate is a fraction 0..1; enforce non-negative amounts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revenue_lines_share_rate_range_chk'
  ) THEN
    ALTER TABLE public.revenue_lines
      ADD CONSTRAINT revenue_lines_share_rate_range_chk
      CHECK (share_rate IS NULL OR (share_rate >= 0 AND share_rate <= 1));
  END IF;
END $$;

-- ---------- Import conflicts (reviewable, never overwritten) --------------
CREATE TABLE IF NOT EXISTS public.revenue_import_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  statement_key text NOT NULL,
  row_key text,
  reason text NOT NULL,
  incoming_payload jsonb NOT NULL,
  existing_import_id uuid REFERENCES public.revenue_imports(id) ON DELETE SET NULL,
  existing_row_id uuid REFERENCES public.revenue_lines(id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution text
);

GRANT SELECT ON public.revenue_import_conflicts TO authenticated;
GRANT ALL ON public.revenue_import_conflicts TO service_role;

ALTER TABLE public.revenue_import_conflicts ENABLE ROW LEVEL SECURITY;

-- Privileged reviewers can read + resolve; ordinary authenticated users cannot.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'revenue_import_conflicts_privileged_select') THEN
    CREATE POLICY revenue_import_conflicts_privileged_select
      ON public.revenue_import_conflicts
      FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'founder')
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'revenue_import_conflicts_privileged_update') THEN
    CREATE POLICY revenue_import_conflicts_privileged_update
      ON public.revenue_import_conflicts
      FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'founder')
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'super_admin')
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'founder')
      );
  END IF;
END $$;

-- No INSERT/DELETE for authenticated. Only service_role can insert/delete.

COMMIT;
