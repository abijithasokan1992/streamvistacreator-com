DO $$
DECLARE
  t record;
  skip_tables text[] := ARRAY[
    'intro_invite_secrets',
    'review_link_secrets',
    'shared_file_secrets',
    'user_roles'
  ];
  pol_name text := 'Admins can read all rows';
BEGIN
  FOR t IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname <> ALL(skip_tables)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t.tname AND policyname=pol_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))',
        pol_name, t.tname
      );
    END IF;
  END LOOP;
END$$;