-- Note: user referenced "titles" but the actual table is public.content_titles.
ALTER TABLE public.content_titles
  ADD COLUMN IF NOT EXISTS qc_status varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS legal_clearance varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS master_rule_enforced boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.content_titles.qc_status IS 'QC panel state: pending | resolution_verified | audio_clean | passed | flagged';
COMMENT ON COLUMN public.content_titles.legal_clearance IS 'Legal panel state: pending | under_review | cleared | rejected';
COMMENT ON COLUMN public.content_titles.master_rule_enforced IS 'Enforces: No Right to Deliver to Next Person (non-sublicensable master rule)';

-- Prevent bypass: master_rule_enforced can only be lowered by service_role / super_admin.
CREATE OR REPLACE FUNCTION public.trg_guard_master_rule_enforced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.master_rule_enforced IS DISTINCT FROM OLD.master_rule_enforced
     AND NEW.master_rule_enforced = false
     AND NOT (
       (SELECT auth.role()) = 'service_role'
       OR public.has_role(auth.uid(), 'super_admin')
     )
  THEN
    RAISE EXCEPTION 'master_rule_enforced is immutable for non-super-admin actors';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_master_rule_enforced ON public.content_titles;
CREATE TRIGGER trg_guard_master_rule_enforced
BEFORE UPDATE ON public.content_titles
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_master_rule_enforced();