
CREATE OR REPLACE FUNCTION public.prevent_content_title_burst_duplicates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dupe_id uuid;
  window_seconds constant int := 5;
  new_j jsonb := to_jsonb(NEW);
  cdid text := new_j->>'client_draft_id';
BEGIN
  IF NEW.owner_user_id IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  IF cdid IS NOT NULL AND cdid <> '' THEN
    EXECUTE 'SELECT id FROM public.content_titles WHERE owner_user_id = $1 AND client_draft_id = $2 LIMIT 1'
      INTO dupe_id USING NEW.owner_user_id, cdid;
    IF dupe_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate title creation for client_draft_id % (existing row %)', cdid, dupe_id
        USING ERRCODE = '23505',
              HINT = 'This draft was already created; refresh to see it.';
    END IF;
  END IF;

  SELECT id INTO dupe_id
    FROM public.content_titles
   WHERE owner_user_id = NEW.owner_user_id
     AND lower(btrim(title)) = lower(btrim(NEW.title))
     AND created_at > (now() - make_interval(secs => window_seconds))
   LIMIT 1;

  IF dupe_id IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate title creation blocked: "%" was just created (row %) — treated as a double-submit.', NEW.title, dupe_id
      USING ERRCODE = '23505',
            HINT = 'Wait a moment before creating another title with the same name.';
  END IF;

  RETURN NEW;
END $function$;
