-- Reversible: DROP FUNCTION public.import_revenue_statement(jsonb);

CREATE OR REPLACE FUNCTION public.import_revenue_statement(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_privileged boolean;
  v_statement_key text := p_payload->>'statement_key';
  v_source_type text := p_payload->>'source_type';
  v_source_label text := COALESCE(p_payload->>'source_label', p_payload->>'source_statement_id');
  v_source_statement_id text := p_payload->>'source_statement_id';
  v_partner_id uuid := NULLIF(p_payload->>'partner_id','')::uuid;
  v_workspace_id uuid := NULLIF(p_payload->>'workspace_id','')::uuid;
  v_currency text := COALESCE(NULLIF(p_payload->>'currency',''), 'INR');
  v_period_start date := NULLIF(p_payload->>'period_start','')::date;
  v_period_end date := NULLIF(p_payload->>'period_end','')::date;
  v_notes text := p_payload->>'notes';
  v_gross_paise bigint := COALESCE((p_payload->>'gross_amount_paise')::bigint, 0);
  v_line_count int := COALESCE((p_payload->>'line_count')::int, 0);
  v_lines jsonb := COALESCE(p_payload->'lines', '[]'::jsonb);
  v_existing_id uuid;
  v_import_id uuid;
  v_inserted int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT (
    public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'super_admin'::app_role)
    OR public.has_role(v_uid, 'platform_owner'::app_role)
    OR public.has_role(v_uid, 'founder'::app_role)
  ) INTO v_privileged;

  IF NOT v_privileged THEN
    RAISE EXCEPTION 'forbidden: revenue import requires privileged role' USING ERRCODE = '42501';
  END IF;

  IF v_statement_key IS NULL OR length(v_statement_key) = 0 THEN
    RAISE EXCEPTION 'statement_key required' USING ERRCODE = '22023';
  END IF;
  IF v_source_type IS NULL OR v_source_statement_id IS NULL THEN
    RAISE EXCEPTION 'source_type and source_statement_id required' USING ERRCODE = '22023';
  END IF;

  -- Dedup: statement_key stashed in notes as "sk=<key>"
  SELECT id INTO v_existing_id
  FROM public.revenue_imports
  WHERE notes ILIKE '%sk=' || v_statement_key || '%'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_statement:%', v_existing_id USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.revenue_imports(
    source_type, source_label, partner_id, period_start, period_end,
    currency, notes, imported_by, gross_amount_paise, line_count, status
  ) VALUES (
    v_source_type, v_source_label, v_partner_id, v_period_start, v_period_end,
    v_currency,
    concat_ws(' | ', 'sk=' || v_statement_key, NULLIF(v_notes, '')),
    v_uid, v_gross_paise, v_line_count, 'imported'
  )
  RETURNING id INTO v_import_id;

  INSERT INTO public.revenue_lines(
    import_id, title_id, deal_memo_id, partner_id, territory, channel,
    units, gross_amount_paise, platform_fee_paise, net_amount_paise,
    currency, occurred_on, metadata
  )
  SELECT
    v_import_id,
    NULLIF(r->>'title_id','')::uuid,
    NULLIF(r->>'deal_memo_id','')::uuid,
    COALESCE(NULLIF(r->>'partner_id','')::uuid, v_partner_id),
    r->>'territory',
    r->>'channel',
    NULLIF(r->>'units','')::int,
    COALESCE((r->>'gross_amount_paise')::bigint, 0),
    COALESCE((r->>'platform_fee_paise')::bigint, 0),
    COALESCE((r->>'net_amount_paise')::bigint, 0),
    COALESCE(NULLIF(r->>'currency',''), v_currency),
    NULLIF(r->>'occurred_on','')::date,
    COALESCE(r->'metadata', '{}'::jsonb)
      || jsonb_build_object(
        'statement_key', v_statement_key,
        'source_type', v_source_type,
        'source_statement_id', v_source_statement_id,
        'workspace_id', v_workspace_id,
        'imported_by', v_uid
      )
  FROM jsonb_array_elements(v_lines) AS r;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'import_id', v_import_id,
    'inserted', v_inserted,
    'statement_key', v_statement_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_revenue_statement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_revenue_statement(jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_revenue_statement(jsonb) IS
  'Atomically imports a revenue statement (header + lines) for privileged roles only. Deduplicates by statement_key stored as "sk=<key>" in revenue_imports.notes. Restore of the Phase D2 RPC; safe to drop and recreate.';