-- ============================================================================
-- Phase D2A/D2B — Revenue Statement Import (PENDING, NOT EXECUTED)
--
-- D2A added typed columns, per-row/statement idempotency, and a conflicts
-- table. D2B hardens workspace isolation and least-privilege RLS on both
-- `revenue_imports` and `revenue_lines`, replacing the previous broad
-- "admins manage" ALL-to-authenticated policies with explicit SELECT /
-- INSERT / UPDATE policies gated by workspace membership, title ownership,
-- and the four privileged roles (admin, super_admin, platform_owner,
-- founder). DELETE is never granted to authenticated — service_role only.
--
-- No destructive SQL beyond dropping the earlier loose policies whose
-- intent is now fully expressed by the tighter policies below.
--
-- Preflight (comment only, do not execute here):
--   -- rows to backfill: SELECT count(*) FROM public.revenue_imports WHERE (notes ILIKE 'sk=%');
--   -- rows already using metadata.statement_key: SELECT count(*) FROM public.revenue_lines
--   --   WHERE metadata ? 'statement_key';
--   -- rows lacking workspace scope after backfill: SELECT count(*) FROM public.revenue_imports WHERE workspace_id IS NULL;
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
  ADD COLUMN IF NOT EXISTS net_amount_paise bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mapping_status text NOT NULL DEFAULT 'unmapped';

CREATE UNIQUE INDEX IF NOT EXISTS revenue_imports_statement_key_uidx
  ON public.revenue_imports(statement_key)
  WHERE statement_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS revenue_imports_workspace_id_idx
  ON public.revenue_imports(workspace_id);

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
  ADD COLUMN IF NOT EXISTS source_statement_id text,
  ADD COLUMN IF NOT EXISTS mapping_status text NOT NULL DEFAULT 'unmapped',
  ADD COLUMN IF NOT EXISTS deal_memo_ref uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS revenue_lines_row_key_uidx
  ON public.revenue_lines(row_key)
  WHERE row_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS revenue_lines_workspace_id_idx
  ON public.revenue_lines(workspace_id);

-- Guard rails.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_lines_share_rate_range_chk') THEN
    ALTER TABLE public.revenue_lines
      ADD CONSTRAINT revenue_lines_share_rate_range_chk
      CHECK (share_rate IS NULL OR (share_rate >= 0 AND share_rate <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_lines_mapping_status_chk') THEN
    ALTER TABLE public.revenue_lines
      ADD CONSTRAINT revenue_lines_mapping_status_chk
      CHECK (mapping_status IN ('unmapped','mapped','hold_for_review','conflict'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'revenue_imports_mapping_status_chk') THEN
    ALTER TABLE public.revenue_imports
      ADD CONSTRAINT revenue_imports_mapping_status_chk
      CHECK (mapping_status IN ('unmapped','partial','mapped','hold_for_review','conflict'));
  END IF;
END $$;

-- ---------- Helper: privileged role check --------------------------------
CREATE OR REPLACE FUNCTION public.is_revenue_privileged(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'admin')
    OR public.has_role(_uid, 'super_admin')
    OR public.has_role(_uid, 'platform_owner')
    OR public.has_role(_uid, 'founder')
$$;

-- ---------- Least-privilege grants ---------------------------------------
-- authenticated may read and privileged operators may import/update through
-- the admin client. RLS below is the authority; ordinary users fail the
-- privileged-role WITH CHECK. DELETE remains service_role-only.
REVOKE DELETE ON public.revenue_imports FROM authenticated;
REVOKE DELETE ON public.revenue_lines FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.revenue_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.revenue_lines TO authenticated;
GRANT ALL ON public.revenue_imports TO service_role;
GRANT ALL ON public.revenue_lines TO service_role;

-- ---------- Drop earlier loose policies ----------------------------------
DROP POLICY IF EXISTS "admins manage revenue imports" ON public.revenue_imports;
DROP POLICY IF EXISTS "admins manage revenue lines" ON public.revenue_lines;
DROP POLICY IF EXISTS "owners view own revenue lines" ON public.revenue_lines;

-- ---------- revenue_imports RLS ------------------------------------------
ALTER TABLE public.revenue_imports ENABLE ROW LEVEL SECURITY;

-- SELECT: privileged reviewers OR active workspace members of the import.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_imports_scoped_select' AND tablename='revenue_imports') THEN
    CREATE POLICY revenue_imports_scoped_select
      ON public.revenue_imports FOR SELECT TO authenticated
      USING (
        public.is_revenue_privileged(auth.uid())
        OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_imports_privileged_insert' AND tablename='revenue_imports') THEN
    CREATE POLICY revenue_imports_privileged_insert
      ON public.revenue_imports FOR INSERT TO authenticated
      WITH CHECK (public.is_revenue_privileged(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_imports_privileged_update' AND tablename='revenue_imports') THEN
    CREATE POLICY revenue_imports_privileged_update
      ON public.revenue_imports FOR UPDATE TO authenticated
      USING (public.is_revenue_privileged(auth.uid()))
      WITH CHECK (public.is_revenue_privileged(auth.uid()));
  END IF;
END $$;
-- No DELETE policy for authenticated — service_role only via grant.

-- ---------- revenue_lines RLS --------------------------------------------
ALTER TABLE public.revenue_lines ENABLE ROW LEVEL SECURITY;

-- SELECT: privileged OR title owner (creator) OR active workspace member.
-- Buyers see rows scoped to their workspace via workspace_id.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_lines_scoped_select' AND tablename='revenue_lines') THEN
    CREATE POLICY revenue_lines_scoped_select
      ON public.revenue_lines FOR SELECT TO authenticated
      USING (
        public.is_revenue_privileged(auth.uid())
        OR (
          title_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.content_titles t
            WHERE t.id = revenue_lines.title_id
              AND t.owner_user_id = auth.uid()
          )
        )
        OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_lines_privileged_insert' AND tablename='revenue_lines') THEN
    CREATE POLICY revenue_lines_privileged_insert
      ON public.revenue_lines FOR INSERT TO authenticated
      WITH CHECK (public.is_revenue_privileged(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_lines_privileged_update' AND tablename='revenue_lines') THEN
    CREATE POLICY revenue_lines_privileged_update
      ON public.revenue_lines FOR UPDATE TO authenticated
      USING (public.is_revenue_privileged(auth.uid()))
      WITH CHECK (public.is_revenue_privileged(auth.uid()));
  END IF;
END $$;

-- ---------- Import conflicts (reviewable, never overwritten) -------------
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

-- Idempotency: never duplicate a conflict for the same (statement_key,row_key,reason).
CREATE UNIQUE INDEX IF NOT EXISTS revenue_import_conflicts_dedupe_uidx
  ON public.revenue_import_conflicts(statement_key, COALESCE(row_key,''), reason);

GRANT SELECT, UPDATE ON public.revenue_import_conflicts TO authenticated;
GRANT ALL ON public.revenue_import_conflicts TO service_role;
REVOKE INSERT, DELETE ON public.revenue_import_conflicts FROM authenticated;

ALTER TABLE public.revenue_import_conflicts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_import_conflicts_privileged_select') THEN
    CREATE POLICY revenue_import_conflicts_privileged_select
      ON public.revenue_import_conflicts FOR SELECT TO authenticated
      USING (public.is_revenue_privileged(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='revenue_import_conflicts_privileged_update') THEN
    CREATE POLICY revenue_import_conflicts_privileged_update
      ON public.revenue_import_conflicts FOR UPDATE TO authenticated
      USING (public.is_revenue_privileged(auth.uid()))
      WITH CHECK (public.is_revenue_privileged(auth.uid()));
  END IF;
END $$;
-- No INSERT / DELETE for authenticated. service_role only.

COMMIT;
