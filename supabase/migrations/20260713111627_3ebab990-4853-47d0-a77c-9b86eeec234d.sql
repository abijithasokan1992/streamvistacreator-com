CREATE OR REPLACE FUNCTION public.__verify_content_title_rls()
RETURNS TABLE(actor text, scenario text, outcome text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator uuid := gen_random_uuid();
  admin_u uuid := gen_random_uuid();
  ws      uuid := gen_random_uuid();
  tid     uuid;
  rec     record;
  cases   jsonb := jsonb_build_array(
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
  -- Seed admin role
  INSERT INTO public.user_roles(user_id, role) VALUES (admin_u, 'admin');

  -- Create a title as system (bypasses trigger/policy since SECURITY DEFINER
  -- runs as owner, but trigger will still fire for non-admin — so we do the
  -- initial insert directly with proper columns).
  INSERT INTO public.content_titles(owner_user_id, workspace_id, title, status, kind)
  VALUES (creator, ws, 'RLS Verify', 'draft'::content_status, 'film')
  RETURNING id INTO tid;

  FOR c IN SELECT * FROM jsonb_array_elements(cases) LOOP
    -- Force starting status without firing the enforce trigger.
    ALTER TABLE public.content_titles DISABLE TRIGGER trg_content_titles_owner_scope;
    UPDATE public.content_titles
       SET status = (c->>'from')::content_status,
           approved_at = NULL, approved_by = NULL, published_at = NULL,
           locked = true
     WHERE id = tid;
    ALTER TABLE public.content_titles ENABLE TRIGGER trg_content_titles_owner_scope;

    -- Impersonate the actor via JWT claim used by auth.uid().
    IF (c->>'actor') = 'creator' THEN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', creator::text)::text, true);
    ELSE
      PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_u::text)::text, true);
    END IF;

    err := NULL;
    BEGIN
      UPDATE public.content_titles
         SET status = (c->>'to')::content_status
       WHERE id = tid;
    EXCEPTION WHEN OTHERS THEN
      err := SQLERRM;
    END;

    actor    := c->>'actor';
    scenario := c->>'name';
    IF err IS NULL THEN
      outcome := CASE WHEN (c->>'expect') = 'allow' THEN 'PASS(allowed)' ELSE 'FAIL(should have denied)' END;
      detail  := 'no error';
    ELSE
      outcome := CASE WHEN (c->>'expect') = 'deny'  THEN 'PASS(denied)' ELSE 'FAIL(should have allowed)' END;
      detail  := err;
    END IF;
    RETURN NEXT;
  END LOOP;

  -- Extra creator-forbidden field writes on a draft row.
  ALTER TABLE public.content_titles DISABLE TRIGGER trg_content_titles_owner_scope;
  UPDATE public.content_titles SET status='draft', locked=true, approved_at=NULL, approved_by=NULL, published_at=NULL WHERE id=tid;
  ALTER TABLE public.content_titles ENABLE TRIGGER trg_content_titles_owner_scope;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', creator::text)::text, true);

  err := NULL;
  BEGIN
    UPDATE public.content_titles SET approved_at = now() WHERE id = tid;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  actor := 'creator'; scenario := 'set approved_at';
  outcome := CASE WHEN err IS NOT NULL THEN 'PASS(denied)' ELSE 'FAIL(should have denied)' END;
  detail := COALESCE(err,'no error'); RETURN NEXT;

  err := NULL;
  BEGIN
    UPDATE public.content_titles SET approved_by = creator WHERE id = tid;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  actor := 'creator'; scenario := 'set approved_by';
  outcome := CASE WHEN err IS NOT NULL THEN 'PASS(denied)' ELSE 'FAIL(should have denied)' END;
  detail := COALESCE(err,'no error'); RETURN NEXT;

  err := NULL;
  BEGIN
    UPDATE public.content_titles SET published_at = now() WHERE id = tid;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  actor := 'creator'; scenario := 'set published_at';
  outcome := CASE WHEN err IS NOT NULL THEN 'PASS(denied)' ELSE 'FAIL(should have denied)' END;
  detail := COALESCE(err,'no error'); RETURN NEXT;

  err := NULL;
  BEGIN
    UPDATE public.content_titles SET locked = false WHERE id = tid;
  EXCEPTION WHEN OTHERS THEN err := SQLERRM; END;
  actor := 'creator'; scenario := 'unlock title';
  outcome := CASE WHEN err IS NOT NULL THEN 'PASS(denied)' ELSE 'FAIL(should have denied)' END;
  detail := COALESCE(err,'no error'); RETURN NEXT;

  -- Cleanup
  DELETE FROM public.content_titles WHERE id = tid;
  DELETE FROM public.user_roles WHERE user_id = admin_u;
END;
$$;

REVOKE ALL ON FUNCTION public.__verify_content_title_rls() FROM PUBLIC, anon, authenticated;