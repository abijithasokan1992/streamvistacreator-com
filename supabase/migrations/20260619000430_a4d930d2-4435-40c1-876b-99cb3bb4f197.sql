
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'advertisements','alumni','api_keys','asset_metadata','asset_versions','assets',
    'carousel_slides','deliverables','media_assets','members','news_articles',
    'notifications','organizations','productions','revenue_transactions',
    'review_comments','scholarships','students','welfare_beneficiaries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Allow users to read their own notifications (table has user_id column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='user_id') THEN
    DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
    CREATE POLICY "Users read own notifications" ON public.notifications
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
