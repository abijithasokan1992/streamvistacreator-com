
-- BEFORE snapshot (visible in migration log)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT role FROM public.user_roles WHERE user_id='7119278d-c8f5-42bc-8dc4-077198eea87f' LOOP
    RAISE NOTICE 'BEFORE role: %', r.role;
  END LOOP;
END $$;

INSERT INTO public.user_roles (user_id, role)
VALUES ('7119278d-c8f5-42bc-8dc4-077198eea87f', 'content_owner')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id='7119278d-c8f5-42bc-8dc4-077198eea87f'
  AND role <> 'content_owner';
