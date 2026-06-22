
-- ============================================================
-- PART 11E PHASE 1 — Creator plan + Storage entitlement + Title lock engine
-- ============================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE public.storage_adjustment_type AS ENUM ('grant', 'reduce', 'set');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.title_edit_request_status AS ENUM ('open','approved','rejected','fulfilled','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.title_section_unlock_status AS ENUM ('open','closed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribution_offer_status AS ENUM ('draft','offered','accepted','rejected','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- SHARED touch trigger (use existing if present) ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============================================================
-- 1. workspace_storage_entitlements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_storage_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL,
  plan_code text NOT NULL DEFAULT 'creator_basic',
  included_storage_gb numeric(12,2) NOT NULL DEFAULT 5,
  paid_storage_gb numeric(12,2) NOT NULL DEFAULT 0,
  admin_bonus_storage_gb numeric(12,2) NOT NULL DEFAULT 0,
  total_storage_gb numeric(12,2) GENERATED ALWAYS AS
    (included_storage_gb + paid_storage_gb + admin_bonus_storage_gb) STORED,
  storage_addon_blocks integer NOT NULL DEFAULT 0,
  warning_threshold_pct integer NOT NULL DEFAULT 80,
  urgent_threshold_pct integer NOT NULL DEFAULT 95,
  hard_stop_threshold_pct integer NOT NULL DEFAULT 100,
  auto_expand_enabled boolean NOT NULL DEFAULT false,
  billing_status text NOT NULL DEFAULT 'ok',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.workspace_storage_entitlements TO authenticated;
GRANT ALL ON public.workspace_storage_entitlements TO service_role;
ALTER TABLE public.workspace_storage_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ent_self_read" ON public.workspace_storage_entitlements;
CREATE POLICY "ent_self_read" ON public.workspace_storage_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "ent_admin_all" ON public.workspace_storage_entitlements;
CREATE POLICY "ent_admin_all" ON public.workspace_storage_entitlements
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_ent_touch ON public.workspace_storage_entitlements;
CREATE TRIGGER trg_ent_touch BEFORE UPDATE ON public.workspace_storage_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. workspace_storage_usage
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL,
  active_bytes bigint NOT NULL DEFAULT 0,
  derived_bytes bigint NOT NULL DEFAULT 0,
  archived_bytes bigint NOT NULL DEFAULT 0,
  billable_bytes bigint NOT NULL DEFAULT 0,
  display_used_bytes bigint NOT NULL DEFAULT 0,
  last_recalculated_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT ON public.workspace_storage_usage TO authenticated;
GRANT ALL ON public.workspace_storage_usage TO service_role;
ALTER TABLE public.workspace_storage_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "usage_self_read" ON public.workspace_storage_usage;
CREATE POLICY "usage_self_read" ON public.workspace_storage_usage
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "usage_admin_all" ON public.workspace_storage_usage;
CREATE POLICY "usage_admin_all" ON public.workspace_storage_usage
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_usage_touch ON public.workspace_storage_usage;
CREATE TRIGGER trg_usage_touch BEFORE UPDATE ON public.workspace_storage_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. workspace_storage_admin_adjustments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_storage_admin_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL,
  adjustment_type public.storage_adjustment_type NOT NULL,
  delta_gb numeric(12,2) NOT NULL DEFAULT 0,
  resulting_bonus_gb numeric(12,2) NOT NULL DEFAULT 0,
  reason text NULL,
  expires_at timestamptz NULL,
  created_by_admin uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.workspace_storage_admin_adjustments TO authenticated;
GRANT ALL ON public.workspace_storage_admin_adjustments TO service_role;
ALTER TABLE public.workspace_storage_admin_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "adj_self_read" ON public.workspace_storage_admin_adjustments;
CREATE POLICY "adj_self_read" ON public.workspace_storage_admin_adjustments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "adj_admin_all" ON public.workspace_storage_admin_adjustments;
CREATE POLICY "adj_admin_all" ON public.workspace_storage_admin_adjustments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 4. title_lock_state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.title_lock_state (
  title_id uuid PRIMARY KEY REFERENCES public.content_titles(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz NULL,
  locked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  lock_reason text NULL,
  current_submission_state text NOT NULL DEFAULT 'draft',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.title_lock_state TO authenticated;
GRANT ALL ON public.title_lock_state TO service_role;
ALTER TABLE public.title_lock_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lock_owner_read" ON public.title_lock_state;
CREATE POLICY "lock_owner_read" ON public.title_lock_state
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = title_id AND ct.owner_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "lock_admin_all" ON public.title_lock_state;
CREATE POLICY "lock_admin_all" ON public.title_lock_state
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_lock_touch ON public.title_lock_state;
CREATE TRIGGER trg_lock_touch BEFORE UPDATE ON public.title_lock_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. title_section_unlocks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.title_section_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  status public.title_section_unlock_status NOT NULL DEFAULT 'open',
  opened_by_admin uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_for_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NULL,
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_section_unlocks_title ON public.title_section_unlocks(title_id, status);
GRANT SELECT ON public.title_section_unlocks TO authenticated;
GRANT ALL ON public.title_section_unlocks TO service_role;
ALTER TABLE public.title_section_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unlock_owner_read" ON public.title_section_unlocks;
CREATE POLICY "unlock_owner_read" ON public.title_section_unlocks
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR opened_for_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = title_id AND ct.owner_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "unlock_admin_all" ON public.title_section_unlocks;
CREATE POLICY "unlock_admin_all" ON public.title_section_unlocks
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 6. title_edit_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.title_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  message text NULL,
  requested_sections text[] NOT NULL DEFAULT '{}',
  status public.title_edit_request_status NOT NULL DEFAULT 'open',
  admin_response text NULL,
  handled_by_admin uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edit_req_title ON public.title_edit_requests(title_id, status);
GRANT SELECT, INSERT ON public.title_edit_requests TO authenticated;
GRANT ALL ON public.title_edit_requests TO service_role;
ALTER TABLE public.title_edit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edit_req_owner_read" ON public.title_edit_requests;
CREATE POLICY "edit_req_owner_read" ON public.title_edit_requests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR creator_user_id = auth.uid()
  );
DROP POLICY IF EXISTS "edit_req_owner_insert" ON public.title_edit_requests;
CREATE POLICY "edit_req_owner_insert" ON public.title_edit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.content_titles ct WHERE ct.id = title_id AND ct.owner_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "edit_req_admin_all" ON public.title_edit_requests;
CREATE POLICY "edit_req_admin_all" ON public.title_edit_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_edit_req_touch ON public.title_edit_requests;
CREATE TRIGGER trg_edit_req_touch BEFORE UPDATE ON public.title_edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 7. distribution_program_offers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.distribution_program_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NULL REFERENCES public.content_titles(id) ON DELETE SET NULL,
  workspace_id uuid NULL,
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.distribution_offer_status NOT NULL DEFAULT 'draft',
  program_name text NOT NULL DEFAULT 'StreamVista Distribution Program',
  rights_scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel_scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  territory_scope_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  term_years integer NOT NULL DEFAULT 5,
  term_start_date date NULL,
  term_end_date date NULL,
  is_non_exclusive boolean NOT NULL DEFAULT true,
  revenue_model text NOT NULL DEFAULT 'revshare_avod_tvod_fast',
  platform_share_pct numeric(5,2) NOT NULL DEFAULT 33.33,
  streamvista_share_pct numeric(5,2) NOT NULL DEFAULT 33.33,
  rights_holder_share_pct numeric(5,2) NOT NULL DEFAULT 33.34,
  termination_notice_days integer NOT NULL DEFAULT 90,
  termination_fee_amount numeric(12,2) NOT NULL DEFAULT 25000,
  termination_fee_currency text NOT NULL DEFAULT 'INR',
  legal_text_snapshot text NULL,
  offered_by_admin uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  offered_at timestamptz NULL,
  accepted_at timestamptz NULL,
  rejected_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dpo_title ON public.distribution_program_offers(title_id);
CREATE INDEX IF NOT EXISTS idx_dpo_creator ON public.distribution_program_offers(creator_user_id, status);
GRANT SELECT, UPDATE ON public.distribution_program_offers TO authenticated;
GRANT ALL ON public.distribution_program_offers TO service_role;
ALTER TABLE public.distribution_program_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dpo_owner_read" ON public.distribution_program_offers;
CREATE POLICY "dpo_owner_read" ON public.distribution_program_offers
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR creator_user_id = auth.uid()
  );
DROP POLICY IF EXISTS "dpo_owner_accept" ON public.distribution_program_offers;
CREATE POLICY "dpo_owner_accept" ON public.distribution_program_offers
  FOR UPDATE TO authenticated
  USING (creator_user_id = auth.uid() AND status = 'offered')
  WITH CHECK (creator_user_id = auth.uid() AND status IN ('accepted','rejected'));
DROP POLICY IF EXISTS "dpo_admin_all" ON public.distribution_program_offers;
CREATE POLICY "dpo_admin_all" ON public.distribution_program_offers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP TRIGGER IF EXISTS trg_dpo_touch ON public.distribution_program_offers;
CREATE TRIGGER trg_dpo_touch BEFORE UPDATE ON public.distribution_program_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RPCs
-- ============================================================

-- Resolve / bootstrap entitlement (back-compat reads from storage_topups + storage_allocations)
CREATE OR REPLACE FUNCTION public.get_workspace_storage_entitlement(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ent public.workspace_storage_entitlements%ROWTYPE;
  legacy_paid_gb numeric := 0;
  legacy_bonus_gb numeric := 0;
  used_bytes bigint := 0;
  legacy_used_mb numeric := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- AuthN gate: only self or admin
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO ent FROM public.workspace_storage_entitlements WHERE user_id = _user_id;

  IF NOT FOUND THEN
    -- Back-compat seed
    SELECT COALESCE(SUM(storage_quantity_tb),0) * 1024
      INTO legacy_paid_gb
      FROM public.subscriptions
      WHERE user_id = _user_id AND status IN ('active','trialing');
    IF legacy_paid_gb IS NULL THEN legacy_paid_gb := 0; END IF;

    BEGIN
      SELECT COALESCE(SUM(allocated_gb),0)
        INTO legacy_bonus_gb
        FROM public.storage_allocations
        WHERE user_id = _user_id
          AND (expires_at IS NULL OR expires_at > now())
          AND source IN ('admin_grant','grace');
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      legacy_bonus_gb := 0;
    END;

    INSERT INTO public.workspace_storage_entitlements
      (user_id, plan_code, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, storage_addon_blocks)
    VALUES
      (_user_id, 'creator_basic', 5, COALESCE(legacy_paid_gb,0), COALESCE(legacy_bonus_gb,0),
       FLOOR(COALESCE(legacy_paid_gb,0) / 1024)::int)
    RETURNING * INTO ent;
  END IF;

  -- Pull usage; fall back to user_profiles.storage_used_mb if no usage row yet
  SELECT display_used_bytes INTO used_bytes FROM public.workspace_storage_usage WHERE user_id = _user_id;
  IF used_bytes IS NULL THEN
    SELECT COALESCE(storage_used_mb,0) INTO legacy_used_mb FROM public.user_profiles WHERE user_id = _user_id;
    used_bytes := (legacy_used_mb * 1024 * 1024)::bigint;
  END IF;

  RETURN jsonb_build_object(
    'user_id', ent.user_id,
    'plan_code', ent.plan_code,
    'included_storage_gb', ent.included_storage_gb,
    'paid_storage_gb', ent.paid_storage_gb,
    'admin_bonus_storage_gb', ent.admin_bonus_storage_gb,
    'total_storage_gb', ent.total_storage_gb,
    'storage_addon_blocks', ent.storage_addon_blocks,
    'warning_threshold_pct', ent.warning_threshold_pct,
    'urgent_threshold_pct', ent.urgent_threshold_pct,
    'hard_stop_threshold_pct', ent.hard_stop_threshold_pct,
    'billing_status', ent.billing_status,
    'used_bytes', used_bytes,
    'used_gb', ROUND((used_bytes::numeric / (1024*1024*1024))::numeric, 4),
    'usage_pct', CASE WHEN ent.total_storage_gb > 0
                      THEN LEAST(100, ROUND(((used_bytes::numeric / (1024*1024*1024)) / ent.total_storage_gb) * 100, 2))
                      ELSE 0 END
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_workspace_storage_entitlement(uuid) TO authenticated, service_role;

-- Admin storage adjustment
CREATE OR REPLACE FUNCTION public.admin_adjust_storage(
  _user_id uuid,
  _type public.storage_adjustment_type,
  _delta_gb numeric,
  _reason text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_bonus numeric;
  ent public.workspace_storage_entitlements%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  -- Ensure entitlement row exists
  PERFORM public.get_workspace_storage_entitlement(_user_id);
  SELECT * INTO ent FROM public.workspace_storage_entitlements WHERE user_id = _user_id;

  new_bonus := CASE _type
    WHEN 'grant'  THEN ent.admin_bonus_storage_gb + _delta_gb
    WHEN 'reduce' THEN GREATEST(0, ent.admin_bonus_storage_gb - _delta_gb)
    WHEN 'set'    THEN GREATEST(0, _delta_gb)
  END;

  UPDATE public.workspace_storage_entitlements
     SET admin_bonus_storage_gb = new_bonus, updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.workspace_storage_admin_adjustments
    (user_id, adjustment_type, delta_gb, resulting_bonus_gb, reason, expires_at, created_by_admin)
  VALUES (_user_id, _type, _delta_gb, new_bonus, _reason, _expires_at, auth.uid());

  BEGIN
    INSERT INTO public.admin_audit_log(actor_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'storage_adjust', 'workspace_storage', _user_id,
      jsonb_build_object('type', _type, 'delta_gb', _delta_gb, 'new_bonus_gb', new_bonus, 'reason', _reason));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'new_bonus_gb', new_bonus);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_storage(uuid, public.storage_adjustment_type, numeric, text, timestamptz)
  TO authenticated, service_role;

-- Lock a title on submission
CREATE OR REPLACE FUNCTION public.creator_lock_title_on_submit(_title_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT owner_user_id INTO owner_id FROM public.content_titles WHERE id = _title_id;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'title not found'; END IF;
  IF owner_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.title_lock_state(title_id, is_locked, locked_at, locked_by, lock_reason, current_submission_state)
  VALUES (_title_id, true, now(), auth.uid(), 'submitted_for_review', 'submitted')
  ON CONFLICT (title_id) DO UPDATE
    SET is_locked = true,
        locked_at = now(),
        locked_by = auth.uid(),
        lock_reason = 'submitted_for_review',
        current_submission_state = 'submitted',
        updated_at = now();

  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.creator_lock_title_on_submit(uuid) TO authenticated, service_role;

-- Creator requests an edit
CREATE OR REPLACE FUNCTION public.creator_request_title_edit(
  _title_id uuid,
  _request_type text,
  _message text,
  _sections text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  owner_id uuid; req_id uuid;
BEGIN
  SELECT owner_user_id INTO owner_id FROM public.content_titles WHERE id = _title_id;
  IF owner_id IS NULL OR owner_id <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;

  INSERT INTO public.title_edit_requests(title_id, creator_user_id, request_type, message, requested_sections)
  VALUES (_title_id, auth.uid(), _request_type, _message, COALESCE(_sections, '{}'))
  RETURNING id INTO req_id;

  RETURN jsonb_build_object('ok', true, 'request_id', req_id);
END $$;
GRANT EXECUTE ON FUNCTION public.creator_request_title_edit(uuid, text, text, text[]) TO authenticated;

-- Admin handles edit request
CREATE OR REPLACE FUNCTION public.admin_handle_title_edit_request(
  _request_id uuid,
  _decision text,                -- 'approved' | 'rejected'
  _response text,
  _unlock_sections text[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req public.title_edit_requests%ROWTYPE;
  sec text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'admin role required'; END IF;

  SELECT * INTO req FROM public.title_edit_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF req.status <> 'open' THEN RAISE EXCEPTION 'request not open'; END IF;

  IF _decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid decision';
  END IF;

  UPDATE public.title_edit_requests
     SET status = _decision::public.title_edit_request_status,
         admin_response = _response,
         handled_by_admin = auth.uid(),
         handled_at = now(),
         updated_at = now()
   WHERE id = _request_id;

  IF _decision = 'approved' AND _unlock_sections IS NOT NULL THEN
    FOREACH sec IN ARRAY _unlock_sections LOOP
      INSERT INTO public.title_section_unlocks
        (title_id, section_key, opened_by_admin, opened_for_user_id, reason)
      VALUES (req.title_id, sec, auth.uid(), req.creator_user_id, _response);
    END LOOP;
  END IF;

  BEGIN
    INSERT INTO public.admin_audit_log(actor_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'title_edit_request_'||_decision, 'title', req.title_id,
      jsonb_build_object('request_id', _request_id, 'sections', _unlock_sections));
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_handle_title_edit_request(uuid, text, text, text[])
  TO authenticated, service_role;

-- ============================================================
-- BACKFILL
-- ============================================================

-- Seed entitlements for existing creators (creator_basic, 5 GB included).
-- Map any historical paid storage subscriptions into paid_storage_gb,
-- and existing admin grants into admin_bonus_storage_gb.
INSERT INTO public.workspace_storage_entitlements
  (user_id, plan_code, included_storage_gb, paid_storage_gb, admin_bonus_storage_gb, storage_addon_blocks)
SELECT
  up.user_id,
  'creator_basic'::text,
  5::numeric,
  COALESCE((
    SELECT SUM(s.storage_quantity_tb) * 1024
    FROM public.subscriptions s
    WHERE s.user_id = up.user_id AND s.status IN ('active','trialing')
  ), 0)::numeric,
  COALESCE((
    SELECT SUM(sa.allocated_gb)
    FROM public.storage_allocations sa
    WHERE sa.user_id = up.user_id
      AND (sa.expires_at IS NULL OR sa.expires_at > now())
      AND sa.source IN ('admin_grant','grace')
  ), 0)::numeric,
  FLOOR(COALESCE((
    SELECT SUM(s.storage_quantity_tb)
    FROM public.subscriptions s
    WHERE s.user_id = up.user_id AND s.status IN ('active','trialing')
  ), 0))::int
FROM public.user_profiles up
ON CONFLICT (user_id) DO NOTHING;

-- Seed usage rows from legacy storage_used_mb
INSERT INTO public.workspace_storage_usage (user_id, display_used_bytes, active_bytes, billable_bytes)
SELECT up.user_id,
       (COALESCE(up.storage_used_mb,0) * 1024 * 1024)::bigint,
       (COALESCE(up.storage_used_mb,0) * 1024 * 1024)::bigint,
       (COALESCE(up.storage_used_mb,0) * 1024 * 1024)::bigint
FROM public.user_profiles up
ON CONFLICT (user_id) DO NOTHING;

-- Seed lock state for any existing titles already past draft
INSERT INTO public.title_lock_state (title_id, is_locked, locked_at, lock_reason, current_submission_state)
SELECT ct.id,
       (ct.status IS NOT NULL AND ct.status <> 'draft'),
       CASE WHEN ct.status IS NOT NULL AND ct.status <> 'draft' THEN ct.updated_at ELSE NULL END,
       CASE WHEN ct.status IS NOT NULL AND ct.status <> 'draft' THEN 'backfill_submitted' ELSE NULL END,
       COALESCE(ct.status, 'draft')
FROM public.content_titles ct
ON CONFLICT (title_id) DO NOTHING;
