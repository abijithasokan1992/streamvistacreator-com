CREATE OR REPLACE FUNCTION public.__verify_content_title_rls(p_creator uuid, p_admin uuid)
RETURNS TABLE(actor text, scenario text, outcome text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws  uuid := gen_random_uuid();
  tid uuid;
  cases jsonb := jsonb_build_array(
    jsonb_build_object('actor','creator','name','draft->draft',           'from','draft',           'to','draft',           'expect','allow'),
    jsonb_build_object('actor','creator','name','draft->submitted',       'from','draft',           'to','submitted',       'expect','allow'),
    jsonb_build_object('actor','creator','name','cr->cr',                 'from','changes_requested','to','changes_requested','expect','allow'),
    jsonb_build_object('actor','creator','name','cr->submitted',          'from','changes_requested','to','submitted',       'expect','allow'),
    jsonb_build_object('actor','creator','name','draft->approved',        'from','draft',           'to','approved',        'expect','deny'),
    jsonb_build_object('actor','creator','name','draft->published',       'from','draft',           'to','published',       'expect','deny'),
    jsonb_build_object('actor','creator','name','draft->rejected',        'from','draft',           'to','rejected',        'expect','deny'),
    jsonb_build_object('actor','creator','name','submitted->draft',       'from','submitted',      'to','draft',           'expect','deny'),
    jsonb_build_object('actor','creator','name','approved->draft',        'from','approved',       'to','draft',           'expect','deny'),
    jsonb_build_object('actor','creator','name','published->draft',       'from','published',      'to','draft',           'expect','deny'),
    jsonb_build_object('actor','admin',  'name','draft->approved',        'from','draft',           'to','approved',        'expect','allow'),
    jsonb_build_object('actor','admin',  'name','submitted->published',   'from','submitted',      'to','published',       'expect','allow'),
    jsonb_build_object('actor','admin',  'name','draft->rejected',        'from','draft',           'to','rejected',        'expect','allow')
  );
  c jsonb;
  err text;
BEGIN
  INSERT INTO public.content_titles(owner_user_id, workspace_id, title, status, kind)
  VALUES (p_creator, ws, '__rls_verify__', 'draft'::content_status, 'film')
  RETURNING id INTO tid;

  FOR c IN SELECT * FROM jsonb_array_elements(cases) LOOP
    ALTER TABLE public.content_titles DISABLE TRIGGER trg_content_titles_owner_scope;
    UPDATE public.content_titles
       SET status = (c->>'from')::content_status,
           approved_at = NULL, approved_by = NULL, published_at = NULL,
           locked = true
     WHERE id = tid;
    ALTER TABLE public.content_titles ENABLE TRIGGER trg_content_titles_owner_scope;

    IF (c->>'actor') = 'creator' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', p_creator::text)::text, true);
    ELSE
      PERFORM set_config('request.jwt.claims', json_build_object('sub', p_admin::text)::text, true);
    END IF;

    err := NULL;
    BEGIN
      UPDATE public.content_titles SET status = (c->>'to')::content_status WHERE id = tid;
    EXCEPTION WHEN OTHERS THEN err := SQLERRM;
    END;

    actor := c->>'actor';
    scenario := c->>'name';
    IF err IS NULL THEN
      outcome := CASE WHEN (c->>'expect') = 'allow' THEN 'PASS(allowed)' ELSE 'FAIL(should deny)' END;
      detail := 'ok';
    ELSE
      outcome := CASE WHEN (c->>'expect') = 'deny'  THEN 'PASS(denied)' ELSE 'FAIL(should allow)' END;
      detail := err;
    END IF;
    RETURN NEXT;
  END LOOP;

  -- Creator-forbidden field writes
  ALTER TABLE public.content_titles DISABLE TRIGGER trg_content_titles_owner_scope;
  UPDATE public.content_titles SET status='draft', locked=true, approved_at=NULL, approved_by=NULL, published_at=NULL WHERE id=tid;
  ALTER TABLE public.content_titles ENABLE TRIGGER trg_content_titles_owner_scope;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_creator::text)::text, true);

  FOR c IN SELECT * FROM jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('name','set approved_at',  'sql','UPDATE public.content_titles SET approved_at=now() WHERE id=$1'),
      jsonb_build_object('name','set approved_by',  'sql','UPDATE public.content_titles SET approved_by=$2 WHERE id=$1'),
      jsonb_build_object('name','set published_at', 'sql','UPDATE public.content_titles SET published_at=now() WHERE id=$1'),
      jsonb_build_object('name','unlock title',     'sql','UPDATE public.content_titles SET locked=false WHERE id=$1')
    )) LOOP
    err := NULL;
    BEGIN
      EXECUTE (c->>'sql') USING tid, p_creator;
    EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
    actor := 'creator'; scenario := c->>'name';
    outcome := CASE WHEN err IS NOT NULL THEN 'PASS(denied)' ELSE 'FAIL(should deny)' END;
    detail := COALESCE(err,'ok'); RETURN NEXT;
  END LOOP;

  DELETE FROM public.content_titles WHERE id = tid;
END;
$$;

REVOKE ALL ON FUNCTION public.__verify_content_title_rls(uuid, uuid) FROM PUBLIC, anon, authenticated;