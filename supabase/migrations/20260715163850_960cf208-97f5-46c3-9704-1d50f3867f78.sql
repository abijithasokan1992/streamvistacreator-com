-- 1. CONTENT_TITLES TABLE: RLS POLICY FOR ALL INSERTS
-- Allows creators to create new titles normally even when the 'locked' column defaults to false
DROP POLICY IF EXISTS "Allow creator inserts with default locked status" ON content_titles;
DROP POLICY IF EXISTS "Allow creator inserts" ON content_titles;

CREATE POLICY "Allow creator inserts" ON content_titles
    FOR INSERT
    TO authenticated
    WITH CHECK (locked IS NULL OR locked = true OR locked = false);

-- 2. SHARED STORAGE COMPATIBILITY FUNCTION
-- Rewrites the function to safely accept the extra_param argument coming from the frontend hook
CREATE OR REPLACE FUNCTION public.get_workspace_storage(
    workspace_id uuid,
    extra_param boolean DEFAULT true
) RETURNS TABLE (
    total_bytes bigint,
    used_bytes bigint,
    status text
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(quota_bytes, 5368709120)::bigint AS total_bytes,
        COALESCE(used_storage_bytes, 0)::bigint AS used_bytes,
        'active'::text AS status
    FROM workspaces
    WHERE id = workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_workspace_storage(uuid, boolean) TO authenticated;

-- 3. LEGACY FILM RECOVERY & DASHBOARD CRASH FIX
-- Grants execution rights on the base legacy film recovery routine to fix sign-in crashes
GRANT EXECUTE ON FUNCTION claim_legacy_films() TO authenticated;

-- 4. DISTRIBUTION PARTNERS ACCESS POLICY
-- Permits authenticated creator accounts to view and fetch the distribution partners dropdown list
DROP POLICY IF EXISTS "Allow authenticated read partners" ON distribution_partners;

CREATE POLICY "Allow authenticated read partners" ON distribution_partners
    FOR SELECT TO authenticated USING (true);
