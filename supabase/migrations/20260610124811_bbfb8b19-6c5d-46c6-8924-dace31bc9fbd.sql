
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'creator')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Upgrade existing client-only users to creator so they bypass the review-link screen.
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT ur.user_id, 'creator'::app_role
FROM public.user_roles ur
WHERE ur.user_id NOT IN (
  SELECT user_id FROM public.user_roles
  WHERE role IN ('admin','executive_producer','creator')
)
ON CONFLICT (user_id, role) DO NOTHING;
