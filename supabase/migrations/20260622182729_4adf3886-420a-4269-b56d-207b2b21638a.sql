
CREATE TABLE IF NOT EXISTS public.title_screening_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Screener',
  source_kind text NOT NULL DEFAULT 'uploaded_screener'
    CHECK (source_kind IN ('uploaded_screener','proxy_asset','vault_asset','external_source')),
  upload_id uuid REFERENCES public.recent_uploads(id) ON DELETE SET NULL,
  external_url text,
  duration_seconds integer,
  file_size bigint,
  mime_type text,
  resolution text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_title_screening_assets_title
  ON public.title_screening_assets(title_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.title_screening_assets TO authenticated;
GRANT ALL ON public.title_screening_assets TO service_role;
ALTER TABLE public.title_screening_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screening_assets_admin_all" ON public.title_screening_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "screening_assets_owner_read" ON public.title_screening_assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = title_screening_assets.title_id AND t.owner_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.screening_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  screening_asset_id uuid REFERENCES public.title_screening_assets(id) ON DELETE SET NULL,
  commercial_request_id uuid REFERENCES public.commercial_requests(id) ON DELETE SET NULL,
  deal_memo_id uuid REFERENCES public.deal_memos(id) ON DELETE SET NULL,
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_email text NOT NULL,
  invite_name text,
  buyer_org_name text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('draft','sent','opened','viewing','completed','expired','revoked')),
  expires_at timestamptz NOT NULL,
  first_opened_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  max_views integer,
  max_progress_pct integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  revoked_at timestamptz,
  revoke_reason text,
  nda_required boolean NOT NULL DEFAULT true,
  watermark_enabled boolean NOT NULL DEFAULT true,
  playback_url text,
  playback_url_expires_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_screening_invites_title ON public.screening_invites(title_id);
CREATE INDEX IF NOT EXISTS idx_screening_invites_buyer ON public.screening_invites(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_screening_invites_request ON public.screening_invites(commercial_request_id);
CREATE INDEX IF NOT EXISTS idx_screening_invites_deal ON public.screening_invites(deal_memo_id);
CREATE INDEX IF NOT EXISTS idx_screening_invites_status ON public.screening_invites(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_invites TO authenticated;
GRANT ALL ON public.screening_invites TO service_role;
ALTER TABLE public.screening_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screening_invites_admin_all" ON public.screening_invites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "screening_invites_buyer_read_own" ON public.screening_invites FOR SELECT TO authenticated
  USING (buyer_user_id IS NOT NULL AND buyer_user_id = auth.uid());
CREATE POLICY "screening_invites_title_owner_read" ON public.screening_invites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.content_titles t WHERE t.id = screening_invites.title_id AND t.owner_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.screening_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.screening_invites(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('invite_created','invite_sent','invite_opened','playback_started','playback_progress','playback_completed','denied_revoked','denied_expired','invite_revoked','invite_extended','playback_url_rotated')),
  progress_pct integer,
  user_agent text,
  ip text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_screening_events_invite ON public.screening_events(invite_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.screening_events TO authenticated;
GRANT ALL ON public.screening_events TO service_role;
ALTER TABLE public.screening_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "screening_events_admin_read" ON public.screening_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "screening_events_admin_insert" ON public.screening_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_title_screening_assets_updated BEFORE UPDATE ON public.title_screening_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_screening_invites_updated BEFORE UPDATE ON public.screening_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.admin_create_screening_invite(
  _title_id uuid, _screening_asset_id uuid, _invite_email text,
  _invite_name text DEFAULT NULL, _buyer_org_name text DEFAULT NULL,
  _buyer_user_id uuid DEFAULT NULL, _commercial_request_id uuid DEFAULT NULL,
  _deal_memo_id uuid DEFAULT NULL,
  _expires_at timestamptz DEFAULT (now() + interval '14 days'),
  _playback_url text DEFAULT NULL, _playback_url_expires_at timestamptz DEFAULT NULL,
  _nda_required boolean DEFAULT true, _max_views integer DEFAULT NULL, _notes text DEFAULT NULL
) RETURNS TABLE(id uuid, token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid; new_token text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _invite_email IS NULL OR length(trim(_invite_email)) = 0 THEN RAISE EXCEPTION 'invite_email required'; END IF;
  new_token := encode(gen_random_bytes(32),'hex');
  INSERT INTO public.screening_invites(
    title_id, screening_asset_id, commercial_request_id, deal_memo_id, buyer_user_id,
    invite_email, invite_name, buyer_org_name, token, status, expires_at,
    playback_url, playback_url_expires_at, nda_required, max_views, notes, created_by
  ) VALUES (
    _title_id, _screening_asset_id, _commercial_request_id, _deal_memo_id, _buyer_user_id,
    lower(trim(_invite_email)), _invite_name, _buyer_org_name, new_token, 'sent', _expires_at,
    _playback_url, _playback_url_expires_at, COALESCE(_nda_required,true), _max_views, _notes, auth.uid()
  ) RETURNING screening_invites.id INTO new_id;
  INSERT INTO public.screening_events(invite_id, kind, actor_user_id) VALUES (new_id, 'invite_created', auth.uid());
  RETURN QUERY SELECT new_id, new_token;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_create_screening_invite(uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,timestamptz,boolean,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_screening_invite(_invite_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.screening_invites SET status='revoked', revoked_at = now(), revoke_reason = _reason WHERE id = _invite_id;
  INSERT INTO public.screening_events(invite_id, kind, actor_user_id, metadata)
    VALUES (_invite_id,'invite_revoked', auth.uid(), jsonb_build_object('reason', _reason));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_revoke_screening_invite(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_extend_screening_invite(
  _invite_id uuid, _new_expires_at timestamptz,
  _new_playback_url text DEFAULT NULL, _new_playback_url_expires_at timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.screening_invites SET
    expires_at = COALESCE(_new_expires_at, expires_at),
    playback_url = COALESCE(_new_playback_url, playback_url),
    playback_url_expires_at = COALESCE(_new_playback_url_expires_at, playback_url_expires_at),
    status = CASE WHEN status IN ('expired','revoked') THEN 'sent' ELSE status END,
    revoked_at = CASE WHEN status='revoked' THEN NULL ELSE revoked_at END
    WHERE id = _invite_id;
  INSERT INTO public.screening_events(invite_id, kind, actor_user_id, metadata)
    VALUES (_invite_id,'invite_extended', auth.uid(), jsonb_build_object('expires_at', _new_expires_at, 'rotated', _new_playback_url IS NOT NULL));
END $$;
GRANT EXECUTE ON FUNCTION public.admin_extend_screening_invite(uuid,timestamptz,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.screening_resolve(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.screening_invites%ROWTYPE; ttl public.content_titles%ROWTYPE; asset public.title_screening_assets%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token) < 8 THEN RETURN jsonb_build_object('ok',false,'reason','invalid'); END IF;
  SELECT * INTO inv FROM public.screening_invites WHERE token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  IF inv.revoked_at IS NOT NULL OR inv.status = 'revoked' THEN
    INSERT INTO public.screening_events(invite_id, kind) VALUES (inv.id,'denied_revoked');
    RETURN jsonb_build_object('ok',false,'reason','revoked');
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.screening_invites SET status='expired' WHERE id = inv.id AND status <> 'expired';
    INSERT INTO public.screening_events(invite_id, kind) VALUES (inv.id,'denied_expired');
    RETURN jsonb_build_object('ok',false,'reason','expired');
  END IF;
  IF inv.max_views IS NOT NULL AND inv.view_count >= inv.max_views THEN
    RETURN jsonb_build_object('ok',false,'reason','exhausted');
  END IF;
  SELECT * INTO ttl FROM public.content_titles WHERE id = inv.title_id;
  SELECT * INTO asset FROM public.title_screening_assets WHERE id = inv.screening_asset_id;
  UPDATE public.screening_invites SET
    first_opened_at = COALESCE(first_opened_at, now()),
    last_viewed_at = now(),
    view_count = view_count + 1,
    status = CASE WHEN status IN ('sent','draft') THEN 'opened' ELSE status END
    WHERE id = inv.id;
  INSERT INTO public.screening_events(invite_id, kind) VALUES (inv.id,'invite_opened');
  RETURN jsonb_build_object(
    'ok', true,
    'invite', jsonb_build_object('id', inv.id, 'title_id', inv.title_id, 'invite_email', inv.invite_email,
      'invite_name', inv.invite_name, 'buyer_org_name', inv.buyer_org_name, 'expires_at', inv.expires_at,
      'nda_required', inv.nda_required, 'watermark_enabled', inv.watermark_enabled),
    'title', jsonb_build_object('id', ttl.id, 'title', ttl.title, 'synopsis', ttl.synopsis,
      'genre', ttl.genre, 'language', ttl.language, 'duration_minutes', ttl.duration_minutes),
    'asset', CASE WHEN asset.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', asset.id, 'label', asset.label, 'duration_seconds', asset.duration_seconds, 'mime_type', asset.mime_type) END,
    'playback_url', CASE WHEN inv.playback_url IS NULL THEN NULL
      WHEN inv.playback_url_expires_at IS NOT NULL AND inv.playback_url_expires_at < now() THEN NULL
      ELSE inv.playback_url END,
    'playback_url_expires_at', inv.playback_url_expires_at);
END $$;
GRANT EXECUTE ON FUNCTION public.screening_resolve(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.screening_log_event(_token text, _kind text, _progress_pct integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.screening_invites%ROWTYPE;
BEGIN
  IF _kind NOT IN ('playback_started','playback_progress','playback_completed') THEN RAISE EXCEPTION 'invalid event kind'; END IF;
  SELECT * INTO inv FROM public.screening_invites WHERE token = _token;
  IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at < now() THEN RETURN; END IF;
  INSERT INTO public.screening_events(invite_id, kind, progress_pct) VALUES (inv.id, _kind, _progress_pct);
  UPDATE public.screening_invites SET
    last_viewed_at = now(),
    max_progress_pct = GREATEST(max_progress_pct, COALESCE(_progress_pct, max_progress_pct)),
    completed = CASE WHEN _kind = 'playback_completed' OR COALESCE(_progress_pct,0) >= 90 THEN true ELSE completed END,
    status = CASE WHEN _kind = 'playback_completed' OR COALESCE(_progress_pct,0) >= 90 THEN 'completed'
      WHEN _kind IN ('playback_started','playback_progress') THEN 'viewing' ELSE status END
    WHERE id = inv.id;
END $$;
GRANT EXECUTE ON FUNCTION public.screening_log_event(text,text,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sweep_screening_invites_expired()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.screening_invites SET status='expired' WHERE expires_at < now() AND status NOT IN ('expired','revoked','completed');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.sweep_screening_invites_expired() TO authenticated;
