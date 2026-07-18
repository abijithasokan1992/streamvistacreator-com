-- Pending only: B2B one-time screener verification and cost-aware asset lifecycle.
-- Do not move to supabase/migrations or execute until staging review is complete.
BEGIN;

ALTER TABLE public.screening_invites
  ADD COLUMN IF NOT EXISTS verification_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_session_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS reset_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reset_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.screening_invites ALTER COLUMN max_views SET DEFAULT 1;
UPDATE public.screening_invites SET max_views = 1 WHERE max_views IS NULL;

ALTER TABLE public.screening_events DROP CONSTRAINT IF EXISTS screening_events_kind_check;
ALTER TABLE public.screening_events
  ADD CONSTRAINT screening_events_kind_check CHECK (kind IN (
    'invite_created','invite_sent','invite_opened','playback_started','playback_progress',
    'playback_completed','denied_revoked','denied_expired','denied_locked','invite_revoked',
    'invite_extended','playback_url_rotated','verification_locked','admin_reset'
  ));

CREATE OR REPLACE FUNCTION public.screening_resolve(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.screening_invites%ROWTYPE;
  ttl public.content_titles%ROWTYPE;
  asset public.title_screening_assets%ROWTYPE;
  can_play boolean := false;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;

  SELECT * INTO inv FROM public.screening_invites WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;

  IF inv.revoked_at IS NOT NULL OR inv.status = 'revoked' THEN
    INSERT INTO public.screening_events(invite_id,kind) VALUES (inv.id,'denied_revoked');
    RETURN jsonb_build_object('ok',false,'reason','revoked');
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE public.screening_invites SET status='expired' WHERE id=inv.id;
    INSERT INTO public.screening_events(invite_id,kind) VALUES (inv.id,'denied_expired');
    RETURN jsonb_build_object('ok',false,'reason','expired');
  END IF;

  IF inv.verification_started_at IS NOT NULL
     AND inv.verification_session_expires_at IS NOT NULL
     AND inv.verification_session_expires_at <= now()
     AND inv.verification_locked_at IS NULL THEN
    UPDATE public.screening_invites
      SET verification_locked_at=now(), status='completed', completed=true
      WHERE id=inv.id;
    INSERT INTO public.screening_events(invite_id,kind,metadata)
      VALUES (inv.id,'verification_locked',jsonb_build_object('reason','session_expired'));
    inv.verification_locked_at := now();
  END IF;

  IF inv.verification_locked_at IS NOT NULL OR inv.completed OR inv.status='completed' THEN
    INSERT INTO public.screening_events(invite_id,kind) VALUES (inv.id,'denied_locked');
    RETURN jsonb_build_object('ok',false,'reason','locked');
  END IF;

  can_play := inv.verification_started_at IS NOT NULL
    AND inv.verification_session_expires_at > now();

  SELECT * INTO ttl FROM public.content_titles WHERE id=inv.title_id;
  SELECT * INTO asset FROM public.title_screening_assets WHERE id=inv.screening_asset_id;

  UPDATE public.screening_invites
    SET first_opened_at=COALESCE(first_opened_at,now()), last_viewed_at=now(),
        status=CASE WHEN status IN ('sent','draft') THEN 'opened' ELSE status END
    WHERE id=inv.id;

  IF inv.first_opened_at IS NULL THEN
    INSERT INTO public.screening_events(invite_id,kind) VALUES (inv.id,'invite_opened');
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'invite',jsonb_build_object(
      'id',inv.id,'title_id',inv.title_id,'invite_email',inv.invite_email,
      'invite_name',inv.invite_name,'buyer_org_name',inv.buyer_org_name,
      'expires_at',inv.expires_at,'nda_required',inv.nda_required,
      'watermark_enabled',inv.watermark_enabled,
      'verification_started_at',inv.verification_started_at,
      'verification_session_expires_at',inv.verification_session_expires_at
    ),
    'title',jsonb_build_object(
      'id',ttl.id,'title',ttl.title,'synopsis',ttl.synopsis,'genre',ttl.genre,
      'language',ttl.language,'duration_minutes',ttl.duration_minutes
    ),
    'asset',CASE WHEN asset.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',asset.id,'label',asset.label,'duration_seconds',asset.duration_seconds,
      'mime_type',asset.mime_type
    ) END,
    'requires_verification_start',NOT can_play,
    'playback_url',CASE
      WHEN NOT can_play THEN NULL
      WHEN inv.playback_url IS NULL THEN NULL
      WHEN inv.playback_url_expires_at IS NOT NULL AND inv.playback_url_expires_at < now() THEN NULL
      ELSE inv.playback_url
    END,
    'playback_url_expires_at',inv.playback_url_expires_at,
    'verification_session_expires_at',inv.verification_session_expires_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.screening_begin_verification(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.screening_invites%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN
    RETURN jsonb_build_object('ok',false,'reason','invalid');
  END IF;
  SELECT * INTO inv FROM public.screening_invites WHERE token=_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  IF inv.revoked_at IS NOT NULL OR inv.status='revoked' THEN
    RETURN jsonb_build_object('ok',false,'reason','revoked');
  END IF;
  IF inv.expires_at <= now() THEN RETURN jsonb_build_object('ok',false,'reason','expired'); END IF;
  IF inv.verification_locked_at IS NOT NULL OR inv.completed OR inv.status='completed' THEN
    RETURN jsonb_build_object('ok',false,'reason','locked');
  END IF;

  IF inv.verification_started_at IS NULL THEN
    UPDATE public.screening_invites SET
      verification_started_at=now(),
      verification_session_expires_at=LEAST(expires_at,now()+interval '2 hours'),
      view_count=view_count+1,
      status='viewing',
      last_viewed_at=now()
    WHERE id=inv.id
    RETURNING * INTO inv;
    INSERT INTO public.screening_events(invite_id,kind,progress_pct)
      VALUES (inv.id,'playback_started',0);
  ELSIF inv.verification_session_expires_at <= now() THEN
    UPDATE public.screening_invites
      SET verification_locked_at=now(),status='completed',completed=true
      WHERE id=inv.id;
    INSERT INTO public.screening_events(invite_id,kind,metadata)
      VALUES (inv.id,'verification_locked',jsonb_build_object('reason','session_expired'));
    RETURN jsonb_build_object('ok',false,'reason','locked');
  END IF;

  RETURN jsonb_build_object(
    'ok',true,
    'playback_url',CASE
      WHEN inv.playback_url IS NULL THEN NULL
      WHEN inv.playback_url_expires_at IS NOT NULL AND inv.playback_url_expires_at < now() THEN NULL
      ELSE inv.playback_url
    END,
    'verification_session_expires_at',inv.verification_session_expires_at
  );
END $$;

CREATE OR REPLACE FUNCTION public.screening_log_event(_token text,_kind text,_progress_pct integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.screening_invites%ROWTYPE; should_lock boolean;
BEGIN
  IF _kind NOT IN ('playback_started','playback_progress','playback_completed') THEN
    RAISE EXCEPTION 'invalid event kind';
  END IF;
  SELECT * INTO inv FROM public.screening_invites WHERE token=_token FOR UPDATE;
  IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at < now()
     OR inv.verification_locked_at IS NOT NULL
     OR inv.verification_started_at IS NULL
     OR inv.verification_session_expires_at <= now() THEN RETURN;
  END IF;

  should_lock := _kind='playback_completed' OR COALESCE(_progress_pct,0)>=90;
  INSERT INTO public.screening_events(invite_id,kind,progress_pct)
    VALUES (inv.id,_kind,_progress_pct);
  UPDATE public.screening_invites SET
    last_viewed_at=now(),
    max_progress_pct=GREATEST(max_progress_pct,COALESCE(_progress_pct,max_progress_pct)),
    completed=CASE WHEN should_lock THEN true ELSE completed END,
    verification_locked_at=CASE WHEN should_lock THEN COALESCE(verification_locked_at,now()) ELSE verification_locked_at END,
    status=CASE WHEN should_lock THEN 'completed' ELSE 'viewing' END
  WHERE id=inv.id;
  IF should_lock THEN
    INSERT INTO public.screening_events(invite_id,kind,metadata)
      VALUES (inv.id,'verification_locked',jsonb_build_object('reason','verified'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_screening_verification(_invite_id uuid,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF length(trim(COALESCE(_reason,''))) < 3 THEN RAISE EXCEPTION 'reset reason required'; END IF;
  UPDATE public.screening_invites SET
    status='sent',completed=false,max_progress_pct=0,view_count=0,
    verification_started_at=NULL,verification_session_expires_at=NULL,
    verification_locked_at=NULL,reset_count=reset_count+1,
    last_reset_at=now(),last_reset_by=auth.uid()
  WHERE id=_invite_id AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite not found or revoked'; END IF;
  INSERT INTO public.screening_events(invite_id,kind,actor_user_id,metadata)
    VALUES (_invite_id,'admin_reset',auth.uid(),jsonb_build_object('reason',trim(_reason)));
END $$;

REVOKE ALL ON FUNCTION public.screening_resolve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.screening_begin_verification(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.screening_log_event(text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reset_screening_verification(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.screening_resolve(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.screening_begin_verification(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.screening_log_event(text,text,integer) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_screening_verification(uuid,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.asset_storage_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid REFERENCES public.content_titles(id) ON DELETE CASCADE,
  screening_asset_id uuid REFERENCES public.title_screening_assets(id) ON DELETE SET NULL,
  object_key text NOT NULL,
  asset_kind text NOT NULL CHECK (asset_kind IN ('master','screener_proxy','trailer','document','delivery_package')),
  lifecycle_state text NOT NULL DEFAULT 'ingest_hot' CHECK (lifecycle_state IN (
    'ingest_hot','proxy_hot','archive_pending','archived','restore_pending','restoring','delivery_hot','expired','error'
  )),
  storage_provider text NOT NULL DEFAULT 'oracle' CHECK (storage_provider IN ('oracle','aws')),
  storage_tier text NOT NULL DEFAULT 'standard' CHECK (storage_tier IN ('standard','infrequent_access','archive')),
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum text,
  legal_hold boolean NOT NULL DEFAULT false,
  archive_after timestamptz,
  delivery_expires_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(storage_provider,object_key)
);

ALTER TABLE public.asset_storage_lifecycle ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.asset_storage_lifecycle TO authenticated;
GRANT ALL ON public.asset_storage_lifecycle TO service_role;
DROP POLICY IF EXISTS asset_storage_lifecycle_admin_all ON public.asset_storage_lifecycle;
CREATE POLICY asset_storage_lifecycle_admin_all ON public.asset_storage_lifecycle
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND public.has_role((SELECT auth.uid()),'admin'))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND public.has_role((SELECT auth.uid()),'admin'));

CREATE TABLE IF NOT EXISTS public.asset_storage_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_id uuid NOT NULL REFERENCES public.asset_storage_lifecycle(id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL,
  reason text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_storage_lifecycle_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT ON public.asset_storage_lifecycle_events TO authenticated;
GRANT ALL ON public.asset_storage_lifecycle_events TO service_role;
DROP POLICY IF EXISTS asset_storage_lifecycle_events_admin ON public.asset_storage_lifecycle_events;
CREATE POLICY asset_storage_lifecycle_events_admin ON public.asset_storage_lifecycle_events
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND public.has_role((SELECT auth.uid()),'admin'))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND public.has_role((SELECT auth.uid()),'admin'));

COMMENT ON TABLE public.asset_storage_lifecycle IS
  'B2B media lifecycle only: masters archive after proxy/checksum validation; only low-cost proxy screeners remain hot; delivery packages are temporary.';
COMMENT ON COLUMN public.asset_storage_lifecycle.legal_hold IS
  'Prevents archive/expiry automation from changing an asset involved in a legal, QC, or active deal hold.';

COMMIT;
