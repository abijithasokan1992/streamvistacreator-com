
-- Part A: Lock down legal_acceptances + controlled RPC

-- 1. Drop direct INSERT policy for users
DROP POLICY IF EXISTS "Users insert own acceptances" ON public.legal_acceptances;

-- 2. Revoke INSERT/UPDATE/DELETE from authenticated; keep SELECT
REVOKE INSERT, UPDATE, DELETE ON public.legal_acceptances FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.legal_acceptances FROM anon;
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;

-- 3. Controlled acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_legal_agreement(
  p_agreement_type public.legal_agreement_type,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS public.legal_acceptances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agreement public.legal_agreements%ROWTYPE;
  v_row public.legal_acceptances%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_agreement
  FROM public.legal_agreements
  WHERE agreement_type = p_agreement_type
    AND is_current = true
    AND is_published = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No current published agreement for type %', p_agreement_type
      USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: return existing acceptance for this user + agreement version
  SELECT * INTO v_row
  FROM public.legal_acceptances
  WHERE user_id = v_uid AND agreement_id = v_agreement.id
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id, agreement_id, agreement_type, version, context
  ) VALUES (
    v_uid, v_agreement.id, v_agreement.agreement_type, v_agreement.version,
    COALESCE(p_context, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_legal_agreement(public.legal_agreement_type, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_legal_agreement(public.legal_agreement_type, jsonb) TO authenticated;

-- 4. Harden has_accepted_agreement to require current + published
CREATE OR REPLACE FUNCTION public.has_accepted_agreement(_user_id uuid, _type public.legal_agreement_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.legal_acceptances la
    JOIN public.legal_agreements a ON a.id = la.agreement_id
    WHERE la.user_id = _user_id
      AND a.agreement_type = _type
      AND a.is_current = true
      AND a.is_published = true
      AND la.version = a.version
  );
$$;
