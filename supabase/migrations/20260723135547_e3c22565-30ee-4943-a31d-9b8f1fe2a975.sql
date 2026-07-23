
-- 1) Members: replace the restrictive ALL-admin-only rule (which ANDs with permissive
-- policies and blocks the intended self/org read) with a restrictive rule that only
-- applies to write commands. Reads remain governed solely by the permissive policies.
DROP POLICY IF EXISTS "Deny non-admin access to members" ON public.members;

CREATE POLICY "Only admins can write members"
ON public.members
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (
  (current_setting('request.method', true) = 'GET')
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Simpler and more robust: split into per-command restrictive policies so SELECT is
-- unaffected while INSERT/UPDATE/DELETE remain admin-only.
DROP POLICY IF EXISTS "Only admins can write members" ON public.members;

CREATE POLICY "Only admins can insert members"
ON public.members AS RESTRICTIVE FOR INSERT TO anon, authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update members"
ON public.members AS RESTRICTIVE FOR UPDATE TO anon, authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete members"
ON public.members AS RESTRICTIVE FOR DELETE TO anon, authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) Branding bucket: scope public SELECT to site/ and footer/ prefixes only.
DROP POLICY IF EXISTS "Public read branding" ON storage.objects;

CREATE POLICY "Public read branding site and footer"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'branding'
  AND (name LIKE 'site/%' OR name LIKE 'footer/%')
);

-- Owners can read their own personal logos under users/{auth.uid()}/*
CREATE POLICY "Users read own branding logo"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'branding'
  AND name LIKE ('users/' || auth.uid()::text || '/%')
);

-- Admins can read any branding object (for moderation)
CREATE POLICY "Admins read all branding"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'branding'
  AND has_role(auth.uid(), 'admin'::app_role)
);
