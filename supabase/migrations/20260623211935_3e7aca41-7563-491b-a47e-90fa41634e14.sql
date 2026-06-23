
DO $$ BEGIN
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'qc_reviewer'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'legal_reviewer'; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
