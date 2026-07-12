-- ═══════════════════════════════════════════════════════════════════
-- BATCH 1 — Foundation Cleanup
-- Title Removal Request workflow + async storage recalc queue
-- ═══════════════════════════════════════════════════════════════════

-- 1) Retention / policy singleton ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.title_removal_policy (
  id                       int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retention_days           int NOT NULL DEFAULT 30,
  grace_days               int NOT NULL DEFAULT 7,
  require_admin_approval   boolean NOT NULL DEFAULT true,
  allow_permanent_removal  boolean NOT NULL DEFAULT true,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid
);
INSERT INTO public.title_removal_policy (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.title_removal_policy TO authenticated;
GRANT ALL    ON public.title_removal_policy TO service_role;
ALTER TABLE public.title_removal_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_read_all_auth" ON public.title_removal_policy
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "policy_admin_update"  ON public.title_removal_policy
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));


-- 2) Removal requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.title_removal_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id       uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE RESTRICT,
  workspace_id   uuid,
  requested_by   uuid NOT NULL,
  mode           text NOT NULL CHECK (mode IN ('archive','permanent')),
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected','archiving',
                                   'archived','purge_scheduled','purging',
                                   'purged','failed','cancelled')),
  reason         text,
  blockers       jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_count     int   NOT NULL DEFAULT 0,
  total_bytes    bigint NOT NULL DEFAULT 0,
  buckets        jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_paths   jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempts       int   NOT NULL DEFAULT 0,
  last_error     text,
  reviewed_by    uuid,
  review_note    text,
  purge_after    timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trr_title      ON public.title_removal_requests(title_id);
CREATE INDEX IF NOT EXISTS idx_trr_requested  ON public.title_removal_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_trr_status     ON public.title_removal_requests(status);
CREATE INDEX IF NOT EXISTS idx_trr_purge_due  ON public.title_removal_requests(purge_after)
  WHERE status IN ('approved','purge_scheduled');

GRANT SELECT, INSERT, UPDATE ON public.title_removal_requests TO authenticated;
GRANT ALL ON public.title_removal_requests TO service_role;
ALTER TABLE public.title_removal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trr_read_owner_or_admin" ON public.title_removal_requests
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "trr_insert_owner" ON public.title_removal_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "trr_update_admin_or_own_cancel" ON public.title_removal_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')
         OR (requested_by = auth.uid() AND status = 'pending'))
  WITH CHECK (public.has_role(auth.uid(),'admin')
         OR (requested_by = auth.uid() AND status IN ('pending','cancelled')));


-- 3) Immutable event log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.title_removal_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid NOT NULL REFERENCES public.title_removal_requests(id) ON DELETE CASCADE,
  actor_id     uuid,
  action       text NOT NULL,
  from_status  text,
  to_status    text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tre_request ON public.title_removal_events(request_id);

GRANT SELECT ON public.title_removal_events TO authenticated;
GRANT ALL    ON public.title_removal_events TO service_role;
ALTER TABLE public.title_removal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tre_read_owner_or_admin" ON public.title_removal_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.title_removal_requests r
    WHERE r.id = title_removal_events.request_id
      AND (r.requested_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
  ));


-- 4) Async storage recalc queue ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.storage_recalc_queue (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid,
  user_id        uuid,
  reason         text NOT NULL,
  status         text NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued','running','completed','failed')),
  attempts       int  NOT NULL DEFAULT 0,
  last_error     text,
  processed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_srq_queued ON public.storage_recalc_queue(status, created_at)
  WHERE status IN ('queued','running');

GRANT ALL ON public.storage_recalc_queue TO service_role;
ALTER TABLE public.storage_recalc_queue ENABLE ROW LEVEL SECURITY;
-- No authenticated policies: service-role/edge-worker only.


-- 5) Preflight — enumerates commercial / legal / delivery blockers ──
CREATE OR REPLACE FUNCTION public.title_removal_preflight(_title_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blockers jsonb := '[]'::jsonb;
  cnt      int;
  file_ct  int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM content_titles t
    WHERE t.id = _title_id
      AND (t.owner_user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- License contracts
  SELECT count(*) INTO cnt FROM license_contracts WHERE title_id = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','license_contracts','count',cnt); END IF;

  -- Deal memos
  SELECT count(*) INTO cnt FROM deal_memos WHERE title_id = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','deal_memos','count',cnt); END IF;

  -- Invoices (both tables)
  SELECT count(*) INTO cnt FROM invoices WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','invoices','count',cnt); END IF;

  SELECT count(*) INTO cnt FROM manual_invoices WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','manual_invoices','count',cnt); END IF;

  -- Payments / settlements / statements
  SELECT count(*) INTO cnt FROM settlements WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','settlements','count',cnt); END IF;

  SELECT count(*) INTO cnt FROM partner_statements WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','partner_statements','count',cnt); END IF;

  -- Distribution
  SELECT count(*) INTO cnt FROM distribution_deliveries WHERE title_id = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','distribution_deliveries','count',cnt); END IF;

  SELECT count(*) INTO cnt FROM distribution_queue WHERE title_id = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','distribution_queue','count',cnt); END IF;

  SELECT count(*) INTO cnt FROM deal_deliveries WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','deal_deliveries','count',cnt); END IF;

  -- Legal
  SELECT count(*) INTO cnt FROM legal_acceptances WHERE (metadata->>'title_id')::uuid = _title_id;
  IF cnt > 0 THEN blockers := blockers || jsonb_build_object('type','legal_acceptances','count',cnt); END IF;

  -- File count (bytes filled by edge worker via storage.list)
  SELECT
    COALESCE((SELECT count(*) FROM title_assets WHERE title_id = _title_id),0)
    + COALESCE((SELECT count(*) FROM title_media_versions WHERE title_id = _title_id),0)
    + COALESCE((SELECT count(*) FROM title_screening_assets WHERE title_id = _title_id),0)
  INTO file_ct;

  RETURN jsonb_build_object(
    'title_id', _title_id,
    'file_count', file_ct,
    'blockers', blockers,
    'can_archive', true,
    'can_permanent', jsonb_array_length(blockers) = 0
  );
END $$;


-- 6) Archive request (immediate; uses existing 'archived' enum value) ──
CREATE OR REPLACE FUNCTION public.title_request_archive(_title_id uuid, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id       uuid;
  prev_status  content_status;
BEGIN
  SELECT status INTO prev_status FROM content_titles
   WHERE id = _title_id
     AND (owner_user_id = auth.uid() OR has_role(auth.uid(),'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'not_authorized'; END IF;

  INSERT INTO title_removal_requests (title_id, requested_by, mode, status, reason, completed_at)
  VALUES (_title_id, auth.uid(), 'archive', 'archived', _reason, now())
  RETURNING id INTO req_id;

  UPDATE content_titles
     SET previous_status = prev_status,
         status = 'archived'::content_status,
         updated_at = now()
   WHERE id = _title_id;

  INSERT INTO title_removal_events (request_id, actor_id, action, from_status, to_status, metadata)
  VALUES (req_id, auth.uid(), 'archive', prev_status::text, 'archived',
          jsonb_build_object('title_id', _title_id));

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'title.archive', 'content_title', _title_id,
          jsonb_build_object('request_id', req_id));

  RETURN req_id;
END $$;


-- 7) Permanent Removal Request (creator submits; admin must approve) ──
CREATE OR REPLACE FUNCTION public.title_request_permanent_removal(_title_id uuid, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req_id   uuid;
  pre      jsonb;
  allowed  boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM content_titles
    WHERE id = _title_id
      AND (owner_user_id = auth.uid() OR has_role(auth.uid(),'admin'))
  ) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT allow_permanent_removal INTO allowed FROM title_removal_policy WHERE id = 1;
  IF NOT COALESCE(allowed, true) THEN RAISE EXCEPTION 'permanent_removal_disabled'; END IF;

  pre := title_removal_preflight(_title_id);

  IF (pre->>'can_permanent')::boolean = false THEN
    RAISE EXCEPTION 'blocked_by_commercial_or_legal_records: %', pre->'blockers';
  END IF;

  INSERT INTO title_removal_requests (
    title_id, requested_by, mode, status, reason, blockers, file_count
  ) VALUES (
    _title_id, auth.uid(), 'permanent', 'pending', _reason,
    pre->'blockers', COALESCE((pre->>'file_count')::int, 0)
  ) RETURNING id INTO req_id;

  INSERT INTO title_removal_events (request_id, actor_id, action, to_status, metadata)
  VALUES (req_id, auth.uid(), 'submit', 'pending', pre);

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'title.permanent_removal.request', 'content_title', _title_id,
          jsonb_build_object('request_id', req_id));

  RETURN req_id;
END $$;


-- 8) Admin approve → schedules purge after retention window ─────────
CREATE OR REPLACE FUNCTION public.admin_removal_approve(_request_id uuid, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          title_removal_requests;
  pol        title_removal_policy;
  purge_at   timestamptz;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO r FROM title_removal_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state'; END IF;

  SELECT * INTO pol FROM title_removal_policy WHERE id = 1;
  purge_at := now() + make_interval(days => COALESCE(pol.retention_days,30) + COALESCE(pol.grace_days,7));

  UPDATE title_removal_requests
     SET status = 'approved',
         reviewed_by = auth.uid(),
         review_note = _note,
         purge_after = purge_at,
         updated_at = now()
   WHERE id = _request_id;

  INSERT INTO title_removal_events (request_id, actor_id, action, from_status, to_status, metadata)
  VALUES (_request_id, auth.uid(), 'approve', 'pending', 'approved',
          jsonb_build_object('purge_after', purge_at, 'note', _note));

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'title.permanent_removal.approve', 'content_title', r.title_id,
          jsonb_build_object('request_id', _request_id, 'purge_after', purge_at));

  RETURN jsonb_build_object('request_id', _request_id, 'purge_after', purge_at);
END $$;


-- 9) Admin reject ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_removal_reject(_request_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r title_removal_requests;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT * INTO r FROM title_removal_requests WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_state'; END IF;

  UPDATE title_removal_requests
     SET status='rejected', reviewed_by=auth.uid(), review_note=_note, updated_at=now(),
         completed_at=now()
   WHERE id = _request_id;

  INSERT INTO title_removal_events (request_id, actor_id, action, from_status, to_status, metadata)
  VALUES (_request_id, auth.uid(), 'reject', 'pending', 'rejected',
          jsonb_build_object('note', _note));

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'title.permanent_removal.reject', 'content_title', r.title_id,
          jsonb_build_object('request_id', _request_id, 'note', _note));
END $$;


-- 10) Cancel (requester or admin, only while pending/approved before purge) ─
CREATE OR REPLACE FUNCTION public.admin_removal_cancel(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r title_removal_requests;
BEGIN
  SELECT * INTO r FROM title_removal_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF r.status NOT IN ('pending','approved','purge_scheduled') THEN
    RAISE EXCEPTION 'invalid_state'; END IF;
  IF NOT (has_role(auth.uid(),'admin') OR r.requested_by = auth.uid()) THEN
    RAISE EXCEPTION 'not_authorized'; END IF;

  UPDATE title_removal_requests
     SET status='cancelled', review_note=_note, updated_at=now(), completed_at=now()
   WHERE id = _request_id;

  INSERT INTO title_removal_events (request_id, actor_id, action, from_status, to_status, metadata)
  VALUES (_request_id, auth.uid(), 'cancel', r.status, 'cancelled',
          jsonb_build_object('note', _note));
END $$;


-- 11) Async storage recalc enqueue (never blocks UI) ────────────────
CREATE OR REPLACE FUNCTION public.storage_recalc_enqueue(
  _workspace_id uuid, _user_id uuid, _reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE job_id uuid;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;
  INSERT INTO storage_recalc_queue (workspace_id, user_id, reason)
  VALUES (_workspace_id, _user_id, _reason)
  RETURNING id INTO job_id;
  RETURN job_id;
END $$;


-- 12) Realtime publication ──────────────────────────────────────────
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.title_removal_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_storage_entitlements;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_storage_usage;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- 13) updated_at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trr_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_trr_updated ON public.title_removal_requests;
CREATE TRIGGER trg_trr_updated BEFORE UPDATE ON public.title_removal_requests
FOR EACH ROW EXECUTE FUNCTION public.trr_touch_updated_at();
