# StreamVista Owner-Controlled Migration — Execution Status

Status date: 2026-07-23

## Fixed identities

- Source Lovable-managed project ref: `hllgmkfqgeuqlmpcirvn`
- Candidate owner-controlled target: `streamvista-crm`
- Target ref: `ohumdxxhtgabpefrgsxr`
- Target organisation: `fhswqhaueegwzhwfshpn`
- Target region: Mumbai (`ap-south-1`)
- Repository: `abijithasokan1992/streamvistacreator-com`

## Source backup evidence

- File type: PostgreSQL custom dump
- Archive format: 1.16.0
- Source PostgreSQL: 17.6
- Created with: pg_dump 18.4
- Size: 12,951,056 bytes
- SHA-256: `edcd419413af178d854ca31965604d85ba13dc009ede6f8179f224ba3ff0d384`

No table data or PII was extracted. The backup is not committed to GitHub.

## Candidate target baseline

- Health: ACTIVE_HEALTHY
- PostgreSQL: 17.6
- Public tables: 10, all with RLS enabled
- Existing CRM business rows: 225
- Auth users: 0
- Storage buckets/objects: 0/0
- Edge Functions: 0

The CRM data must be preserved. The target is conditionally suitable, not approved for direct restore.

## Blocking gates

| Gate | Status | Required evidence |
| --- | --- | --- |
| CRM backup/checkpoint | BLOCKED | Independent export plus checksum before import |
| Source dump TOC | BLOCKED | PostgreSQL 18 `pg_restore --list` output kept private |
| Name-collision report | BLOCKED | Source TOC compared with target catalog; include `public.set_updated_at()` |
| Isolated restore environment | BLOCKED | Empty PostgreSQL 17/18 staging database with adequate capacity |
| Selective restore plan | BLOCKED | Explicit exclusion of managed Auth, Storage and migration metadata schemas |
| CRM security release gate | BLOCKED | Review two security-definer views, broad anonymous grants and PUBLIC function execute |
| Auth migration | BLOCKED | Owner-approved method; no password/token exposure |
| Storage migration | BLOCKED | Separate object manifest/checksums and private-path controls |
| Edge Functions | BLOCKED | Function-by-function auth contract; no bulk deployment |
| Secrets | BLOCKED | Names-only manifest; values entered through provider secret manager |
| Production cutover | BLOCKED | Staging tests, reconciliation, rollback rehearsal and explicit owner approval |

## Safety decisions

1. Do not delete or overwrite `streamvista-crm`.
2. Do not restore the source dump directly into the CRM project.
3. Do not restore managed `auth`, `storage`, or migration-history schemas wholesale.
4. Do not deploy `supabase/config.toml` unchanged because it pins the Lovable source ref.
5. Do not reuse the generated Lovable MCP manifest as the independent gateway allowlist.
6. Treat the tracked `.env` as a secret-history risk without reading or printing values.
7. Keep database exports, private reports and object manifests out of Git.
8. No DNS, domain, production, billing or Lovable publishing change occurs before the final cutover approval.

## Next executable checkpoint

On an owner-controlled Mac or isolated host with official PostgreSQL 18 client:

```bash
scripts/migration/validate-source-backup.sh \
  /private/path/streamvista-creator_260723.backup \
  edcd419413af178d854ca31965604d85ba13dc009ede6f8179f224ba3ff0d384 \
  /private/path/streamvista-migration-evidence
```

Then create a CRM backup/checksum and run the catalog-only query in `scripts/migration/target-catalog.sql`. Keep both outputs private. A collision-classified selective restore plan must be reviewed before any import.

## Changes performed in this phase

- Added database-export/private-evidence ignore rules.
- Added a checksum and TOC validation gate that cannot restore or connect to a database.
- Added catalog-only target inspection SQL.
- Recorded migration identities, baseline, gates and safe next checkpoint.

No database writes, imports, restores, deployments, secret changes, DNS changes, deletes or production changes were performed.
