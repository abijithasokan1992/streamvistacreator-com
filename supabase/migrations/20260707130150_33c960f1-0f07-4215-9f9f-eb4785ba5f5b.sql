-- Assignment-scoped RLS for reviewer tables.
-- qc_reviewer and legal_reviewer can access only rows for titles they are
-- assigned to at the matching stage. Admins/super_admins keep full access
-- via the existing "admins manage ..." policies (not modified here).

CREATE OR REPLACE FUNCTION public.is_assigned_reviewer(_title_id uuid, _stage text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.title_review_assignments a
    WHERE a.title_id = _title_id
      AND a.stage = _stage
      AND a.reviewer_user_id = auth.uid()
      AND (
        (_stage = 'qc'    AND public.has_role(auth.uid(), 'qc_reviewer'::app_role))
        OR (_stage = 'legal' AND public.has_role(auth.uid(), 'legal_reviewer'::app_role))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer(uuid, text) TO authenticated;

-- title_review_assignments: reviewer sees their own assignment rows
DROP POLICY IF EXISTS "reviewers read own assignments" ON public.title_review_assignments;
CREATE POLICY "reviewers read own assignments"
  ON public.title_review_assignments FOR SELECT
  TO authenticated
  USING (
    reviewer_user_id = auth.uid()
    AND (
      (stage = 'qc'    AND public.has_role(auth.uid(), 'qc_reviewer'::app_role))
      OR (stage = 'legal' AND public.has_role(auth.uid(), 'legal_reviewer'::app_role))
    )
  );

-- title_review_checklist
DROP POLICY IF EXISTS "reviewers read assigned checklist" ON public.title_review_checklist;
CREATE POLICY "reviewers read assigned checklist"
  ON public.title_review_checklist FOR SELECT
  TO authenticated
  USING (public.is_assigned_reviewer(title_id, stage));

DROP POLICY IF EXISTS "reviewers update assigned checklist" ON public.title_review_checklist;
CREATE POLICY "reviewers update assigned checklist"
  ON public.title_review_checklist FOR UPDATE
  TO authenticated
  USING (public.is_assigned_reviewer(title_id, stage))
  WITH CHECK (public.is_assigned_reviewer(title_id, stage));

DROP POLICY IF EXISTS "reviewers insert assigned checklist" ON public.title_review_checklist;
CREATE POLICY "reviewers insert assigned checklist"
  ON public.title_review_checklist FOR INSERT
  TO authenticated
  WITH CHECK (public.is_assigned_reviewer(title_id, stage));

-- title_review_issues
DROP POLICY IF EXISTS "reviewers read assigned issues" ON public.title_review_issues;
CREATE POLICY "reviewers read assigned issues"
  ON public.title_review_issues FOR SELECT
  TO authenticated
  USING (public.is_assigned_reviewer(title_id, stage));

DROP POLICY IF EXISTS "reviewers write assigned issues" ON public.title_review_issues;
CREATE POLICY "reviewers write assigned issues"
  ON public.title_review_issues FOR INSERT
  TO authenticated
  WITH CHECK (public.is_assigned_reviewer(title_id, stage) AND raised_by = auth.uid());

DROP POLICY IF EXISTS "reviewers update assigned issues" ON public.title_review_issues;
CREATE POLICY "reviewers update assigned issues"
  ON public.title_review_issues FOR UPDATE
  TO authenticated
  USING (public.is_assigned_reviewer(title_id, stage))
  WITH CHECK (public.is_assigned_reviewer(title_id, stage));

-- title_review_notes (internal notes) — scoped by any assignment on the title
CREATE OR REPLACE FUNCTION public.is_assigned_reviewer_any(_title_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.title_review_assignments a
    WHERE a.title_id = _title_id
      AND a.reviewer_user_id = auth.uid()
      AND (
        (a.stage = 'qc'    AND public.has_role(auth.uid(), 'qc_reviewer'::app_role))
        OR (a.stage = 'legal' AND public.has_role(auth.uid(), 'legal_reviewer'::app_role))
      )
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_assigned_reviewer_any(uuid) TO authenticated;

DROP POLICY IF EXISTS "reviewers read assigned notes" ON public.title_review_notes;
CREATE POLICY "reviewers read assigned notes"
  ON public.title_review_notes FOR SELECT
  TO authenticated
  USING (public.is_assigned_reviewer_any(title_id));

DROP POLICY IF EXISTS "reviewers insert assigned notes" ON public.title_review_notes;
CREATE POLICY "reviewers insert assigned notes"
  ON public.title_review_notes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_assigned_reviewer_any(title_id) AND author_user_id = auth.uid());
