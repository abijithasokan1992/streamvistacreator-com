DROP POLICY IF EXISTS "Users insert own acceptances" ON public.legal_acceptances;

CREATE POLICY "Users insert own acceptances"
ON public.legal_acceptances
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.legal_agreements a
    WHERE a.id = legal_acceptances.agreement_id
      AND a.is_current = true
      AND a.is_published = true
      AND a.version = legal_acceptances.version
  )
);