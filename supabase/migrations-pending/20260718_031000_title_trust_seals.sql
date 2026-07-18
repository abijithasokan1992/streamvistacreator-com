BEGIN;

-- Paid, version-bound QC / Legal trust seals.
-- Pending only: this file must be tested on staging before promotion.

DO $$ BEGIN
  CREATE TYPE public.title_trust_seal_kind AS ENUM ('qc_verified', 'legal_cleared');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.title_trust_seal_state AS ENUM ('issued', 'expired', 'revoked', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.title_trust_seals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id uuid NOT NULL REFERENCES public.content_titles(id) ON DELETE CASCADE,
  seal_kind public.title_trust_seal_kind NOT NULL,
  state public.title_trust_seal_state NOT NULL DEFAULT 'issued',
  version_fingerprint text NOT NULL CHECK (char_length(version_fingerprint) BETWEEN 16 AND 256),
  report_reference text,
  service_order_id uuid,
  issued_by uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  superseded_by uuid REFERENCES public.title_trust_seals(id) ON DELETE SET NULL,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until IS NULL OR valid_until > issued_at),
  CHECK (
    (state <> 'revoked')
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND char_length(btrim(revoke_reason)) >= 3)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS title_trust_seals_one_live_version
  ON public.title_trust_seals (title_id, seal_kind, version_fingerprint)
  WHERE state = 'issued';

CREATE INDEX IF NOT EXISTS title_trust_seals_title_state_idx
  ON public.title_trust_seals (title_id, state, issued_at DESC);

CREATE TABLE IF NOT EXISTS public.title_trust_seal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seal_id uuid NOT NULL REFERENCES public.title_trust_seals(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('issued', 'revoked', 'expired', 'superseded')),
  actor_user_id uuid,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.title_trust_seals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.title_trust_seal_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.title_trust_seals TO authenticated;
GRANT SELECT ON public.title_trust_seal_events TO authenticated;
GRANT ALL ON public.title_trust_seals, public.title_trust_seal_events TO service_role;

DROP POLICY IF EXISTS "Admins manage title trust seals" ON public.title_trust_seals;
CREATE POLICY "Admins manage title trust seals"
  ON public.title_trust_seals FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Stakeholders read issued title trust seals" ON public.title_trust_seals;
CREATE POLICY "Stakeholders read issued title trust seals"
  ON public.title_trust_seals FOR SELECT TO authenticated
  USING (
    state = 'issued'
    AND (valid_until IS NULL OR valid_until > now())
    AND (
      EXISTS (
        SELECT 1 FROM public.content_titles ct
        WHERE ct.id = title_id AND ct.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.commercial_requests cr
        WHERE cr.title_id = title_id
          AND cr.buyer_user_id = auth.uid()
          AND cr.state IN ('approved_for_negotiation', 'agreement_pending', 'delivery_authorized', 'closed')
      )
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'platform_owner')
      OR public.has_role(auth.uid(), 'founder')
    )
  );

DROP POLICY IF EXISTS "Stakeholders read trust seal events" ON public.title_trust_seal_events;
CREATE POLICY "Stakeholders read trust seal events"
  ON public.title_trust_seal_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.title_trust_seals s
      WHERE s.id = seal_id
    )
  );

CREATE OR REPLACE FUNCTION public.admin_issue_title_trust_seal(
  _title_id uuid,
  _seal_kind public.title_trust_seal_kind,
  _version_fingerprint text,
  _report_reference text DEFAULT NULL,
  _service_order_id uuid DEFAULT NULL,
  _valid_until timestamptz DEFAULT NULL,
  _internal_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seal_id uuid;
  _qc text;
  _legal text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  ) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;

  IF char_length(btrim(coalesce(_version_fingerprint, ''))) < 16 THEN
    RAISE EXCEPTION 'A version fingerprint is required';
  END IF;

  SELECT qc_status, legal_clearance INTO _qc, _legal
  FROM public.content_titles
  WHERE id = _title_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Title not found'; END IF;
  IF _seal_kind = 'qc_verified' AND _qc <> 'passed' THEN
    RAISE EXCEPTION 'QC must be passed before issuing QC Verified';
  END IF;
  IF _seal_kind = 'legal_cleared' AND _legal <> 'cleared' THEN
    RAISE EXCEPTION 'Legal clearance must be cleared before issuing Legal Cleared';
  END IF;

  UPDATE public.title_trust_seals
  SET state = 'superseded'
  WHERE title_id = _title_id AND seal_kind = _seal_kind AND state = 'issued';

  INSERT INTO public.title_trust_seals (
    title_id, seal_kind, version_fingerprint, report_reference,
    service_order_id, issued_by, valid_until, internal_notes
  ) VALUES (
    _title_id, _seal_kind, btrim(_version_fingerprint), nullif(btrim(_report_reference), ''),
    _service_order_id, auth.uid(), _valid_until, _internal_notes
  ) RETURNING id INTO _seal_id;

  INSERT INTO public.title_trust_seal_events (seal_id, event_kind, actor_user_id, details)
  VALUES (_seal_id, 'issued', auth.uid(), jsonb_build_object('version_fingerprint', btrim(_version_fingerprint)));

  RETURN _seal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_title_trust_seal(
  _seal_id uuid,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'founder')
  ) THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  IF char_length(btrim(coalesce(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Revocation reason is required';
  END IF;

  UPDATE public.title_trust_seals
  SET state = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(_reason)
  WHERE id = _seal_id AND state = 'issued';

  IF NOT FOUND THEN RAISE EXCEPTION 'Active seal not found'; END IF;

  INSERT INTO public.title_trust_seal_events (seal_id, event_kind, actor_user_id, reason)
  VALUES (_seal_id, 'revoked', auth.uid(), btrim(_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_issue_title_trust_seal(uuid, public.title_trust_seal_kind, text, text, uuid, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_revoke_title_trust_seal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_issue_title_trust_seal(uuid, public.title_trust_seal_kind, text, text, uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_title_trust_seal(uuid, text) TO authenticated;

COMMIT;
