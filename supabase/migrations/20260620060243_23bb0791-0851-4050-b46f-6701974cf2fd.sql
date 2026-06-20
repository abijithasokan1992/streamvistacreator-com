
-- Stream 8.1 — free-tier title quotas + content-type aware constraints.

-- Helper: is this user on the free plan right now?
-- Free = no creator role *and* user_profiles.plan_tier is NULL/'free'
--        *and* no active paid plan_assignment to a non-free plan.
CREATE OR REPLACE FUNCTION public.is_free_tier_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND NOT public.has_role(_user_id, 'admin'::public.app_role)
    AND NOT public.is_super_admin(_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.plan_assignments pa
      JOIN public.plans p ON p.id = pa.plan_id
      WHERE pa.user_id = _user_id
        AND pa.status = 'active'
        AND COALESCE(p.code,'') <> 'free'
    )
    AND COALESCE(
      (SELECT plan_tier FROM public.user_profiles WHERE user_id = _user_id),
      'free'
    ) IN ('free','');
$$;

-- Public RPC for the UI: tell the client whether the user can create a new draft
-- or submit another title under the free-tier quota.
CREATE OR REPLACE FUNCTION public.creator_free_tier_status(_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free boolean;
  v_drafts int;
  v_lifecycle int;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('is_free', false, 'draft_count', 0, 'lifecycle_count', 0,
                              'can_create_draft', true, 'can_submit', true,
                              'max_drafts', NULL, 'max_submissions', NULL);
  END IF;

  v_free := public.is_free_tier_user(_user_id);

  SELECT COUNT(*) INTO v_drafts
    FROM public.content_titles
   WHERE owner_user_id = _user_id
     AND status IN ('draft','incomplete','changes_requested');

  SELECT COUNT(*) INTO v_lifecycle
    FROM public.content_titles
   WHERE owner_user_id = _user_id
     AND status IN ('submitted','in_review','qc_review','legal_review',
                    'approved','ready_for_distribution','published','hold');

  RETURN jsonb_build_object(
    'is_free', v_free,
    'draft_count', v_drafts,
    'lifecycle_count', v_lifecycle,
    'max_drafts',      CASE WHEN v_free THEN 1 ELSE NULL END,
    'max_submissions', CASE WHEN v_free THEN 1 ELSE NULL END,
    'can_create_draft', NOT v_free OR v_drafts < 1,
    'can_submit',       NOT v_free OR v_lifecycle < 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.creator_free_tier_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_free_tier_user(uuid)        TO authenticated;

-- Server-side enforcement: free users cannot create a second draft, and cannot
-- submit/transition a second title into the active review lifecycle.
CREATE OR REPLACE FUNCTION public.enforce_free_tier_title_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free boolean;
  v_count int;
  draft_states  text[] := ARRAY['draft','incomplete','changes_requested'];
  lifecycle_states text[] := ARRAY['submitted','in_review','qc_review','legal_review',
                                   'approved','ready_for_distribution','published','hold'];
BEGIN
  -- Admins / super admins bypass.
  IF public.has_role(auth.uid(),'admin'::public.app_role)
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  v_free := public.is_free_tier_user(NEW.owner_user_id);
  IF NOT v_free THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text = ANY(draft_states) THEN
      SELECT COUNT(*) INTO v_count
        FROM public.content_titles
       WHERE owner_user_id = NEW.owner_user_id
         AND status::text = ANY(draft_states);
      IF v_count >= 1 THEN
        RAISE EXCEPTION 'Free plan includes 1 draft title at a time. Complete, submit, or delete your existing draft to continue.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: catch any transition into the active lifecycle.
  IF TG_OP = 'UPDATE'
     AND NEW.status::text = ANY(lifecycle_states)
     AND (OLD.status IS NULL OR NOT (OLD.status::text = ANY(lifecycle_states))) THEN
    SELECT COUNT(*) INTO v_count
      FROM public.content_titles
     WHERE owner_user_id = NEW.owner_user_id
       AND id <> NEW.id
       AND status::text = ANY(lifecycle_states);
    IF v_count >= 1 THEN
      RAISE EXCEPTION 'Free plan includes 1 title submission. Upgrade to submit more titles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_tier_title_quota_ins ON public.content_titles;
DROP TRIGGER IF EXISTS trg_enforce_free_tier_title_quota_upd ON public.content_titles;

CREATE TRIGGER trg_enforce_free_tier_title_quota_ins
BEFORE INSERT ON public.content_titles
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_tier_title_quota();

CREATE TRIGGER trg_enforce_free_tier_title_quota_upd
BEFORE UPDATE ON public.content_titles
FOR EACH ROW EXECUTE FUNCTION public.enforce_free_tier_title_quota();
