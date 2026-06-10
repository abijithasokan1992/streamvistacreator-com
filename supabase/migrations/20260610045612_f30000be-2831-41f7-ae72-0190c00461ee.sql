
DO $$ BEGIN
  CREATE TYPE public.admin_division AS ENUM ('ops','finance','dev','marketing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.admin_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  division public.admin_division NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, division)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_divisions TO authenticated;
GRANT ALL ON public.admin_divisions TO service_role;

ALTER TABLE public.admin_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read divisions" ON public.admin_divisions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert divisions" ON public.admin_divisions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete divisions" ON public.admin_divisions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
