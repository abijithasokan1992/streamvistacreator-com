
CREATE OR REPLACE FUNCTION public.prevent_content_title_burst_duplicates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dupe_id uuid;
  window_seconds constant int := 5;
BEGIN
  IF NEW.owner_user_id IS NULL OR NEW.title IS NULL OR btrim(NEW.title) = '' THEN
    RETURN NEW;
  END IF;

  -- If the caller supplied a client_draft_id, createTitle()'s lookup layer
  -- already handles idempotency for that specific retry chain — don't block
  -- distinct drafts that legitimately share a working title.
  IF NEW.client_draft_id IS NOT NULL THEN
    SELECT id INTO dupe_id
      FROM public.content_titles
     WHERE owner_user_id = NEW.owner_user_id
       AND client_draft_id = NEW.client_draft_id
     LIMIT 1;
    IF dupe_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate title creation for client_draft_id % (existing row %)', NEW.client_draft_id, dupe_id
        USING ERRCODE = '23505',
              HINT = 'This draft was already created; refresh to see it.';
    END IF;
  END IF;

  -- Burst guard: same owner + same normalized title within N seconds.
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

DROP TRIGGER IF EXISTS trg_prevent_content_title_burst_duplicates ON public.content_titles;
CREATE TRIGGER trg_prevent_content_title_burst_duplicates
  BEFORE INSERT ON public.content_titles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_content_title_burst_duplicates();
