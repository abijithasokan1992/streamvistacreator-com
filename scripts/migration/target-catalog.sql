-- Read-only catalog evidence for migration collision analysis.
-- Run only against an owner-controlled staging/target connection.
-- This file performs no application function calls and no mutations.

SELECT n.nspname AS schema_name,
       c.relkind::text AS object_kind,
       c.relname AS object_name
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'private')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
ORDER BY 1, 2, 3;

SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       p.prosecdef AS security_definer
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
ORDER BY 1, 2, 3;
