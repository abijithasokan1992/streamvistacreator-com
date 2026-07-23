# StreamVista Unified Supabase Migration Plan

Status: read-only planning checkpoint. No restore, import, schema change, deletion, deployment, DNS change, or secret rotation has been performed.

## Decision

Use the existing owner-controlled Supabase project `streamvista-crm` as the candidate unified StreamVista target instead of deleting it or creating a third project.

This is the lowest-cost path, but it is conditional on a collision-free dry run and preservation of all CRM records.

## Identities

| System | Identifier |
|---|---|
| Source Lovable Cloud | `hllgmkfqgeuqlmpcirvn` |
| Candidate owner target | `ohumdxxhtgabpefrgsxr` |
| Supabase organisation | `fhswqhaueegwzhwfshpn` |
| Region | `ap-south-1` |
| Source backup | `streamvista-creator_260723.backup` |
| Backup SHA-256 | `edcd419413af178d854ca31965604d85ba13dc009ede6f8179f224ba3ff0d384` |

## Candidate target inventory

The owner-controlled CRM project is not empty.

| Table | Aggregate rows |
|---|---:|
| `crm_organizations` | 66 |
| `crm_contacts` | 53 |
| `crm_sources` | 27 |
| `crm_communications` | 28 |
| `crm_opportunities` | 13 |
| `crm_tasks` | 26 |
| `crm_applications` | 5 |
| `crm_user_access` | 0 |
| `crm_agents` | 7 |
| `crm_agent_daily_performance` | 0 |

No PII rows were read. Counts only.

Current target Auth user count is 0 and Storage bucket count is 0. Supabase-managed Auth/Storage system tables are present and must not be overwritten blindly.

## Source evidence

The source audit reports approximately:

- 195 public tables;
- 535 public RLS policies;
- 225 SECURITY DEFINER functions;
- 11 application storage buckets;
- 84 Edge Functions;
- four JWT email-match policy findings;
- creator-revenue workspace isolation risk;
- MCP audit completeness issues;
- known schema-drift and workflow failures.

The source database dump is a valid PostgreSQL custom-format archive. Full archive catalogue validation is still required with a compatible `pg_restore`.

## Non-negotiable preservation rules

1. Do not drop, truncate, overwrite, or rename any `crm_*` table before a verified backup and collision report.
2. Do not restore source `auth`, `storage`, `realtime`, extension, ownership, or platform-managed objects blindly.
3. Do not migrate password hashes, access/refresh tokens, OAuth secrets, API keys, private keys, or unredacted payment credentials.
4. Do not commit database dumps, secrets, exports, or PII to GitHub.
5. Do not point `streamvista.in` or the production app to the target until reconciliation, security tests, and rollback tests pass.
6. Do not change the Lovable production source during preparation.

## Migration workspaces

```text
migration/
  source-analysis/
  cleaned/
  mappings/
  quarantine/
  scripts/
  reports/
  validation/
```

These directories may contain scripts, schemas, aggregate reports, and synthetic fixtures only. Production row exports and secret-bearing files remain outside Git.

## Required phases

### Phase 0 — backups and catalogue

- obtain a CRM project backup before any write;
- validate the source archive catalogue using PostgreSQL 17-compatible tooling;
- inventory extensions, schemas, tables, sequences, views, functions, triggers, policies, publications, and grants;
- inventory Storage buckets/objects separately;
- inventory Edge Function names, Jobs, Realtime and secret names separately;
- produce a source-versus-target object collision report.

### Phase 1 — dry-run planning

- create an allowlist for source `public` objects;
- exclude Supabase platform-managed schemas unless an official migration procedure explicitly requires them;
- classify collisions as preserve-target, replace-source, rename, merge, or manual review;
- generate deterministic ID mapping and quarantine rules;
- generate restore commands but do not execute them;
- validate PostgreSQL 17 extension compatibility.

### Phase 2 — isolated restore

Requires separate approval and an isolated non-production database/environment.

- restore schema before data;
- restore selected application data;
- preserve and reconcile `crm_*` records;
- restore sequences and validate foreign keys;
- run RLS, grants, function security, and advisor checks;
- record restore errors without retrying destructive operations.

### Phase 3 — application services

- migrate Auth identities through a supported identity migration path;
- migrate Storage objects and verify checksums;
- deploy Edge Functions from GitHub source;
- configure secret values only through the target secret store;
- configure Jobs, webhooks, OAuth redirect URIs and Realtime after explicit approval.

### Phase 4 — validation

Minimum test personas:

- Platform Owner / Founder / Super Admin;
- Admin;
- Creator;
- Buyer;
- Finance;
- QC;
- Legal;
- Support;
- authenticated user without a role;
- anonymous user.

Required checks:

- owner access preserved;
- creator/buyer ownership and workspace isolation;
- cross-workspace revenue denial;
- personal branding files private;
- JWT email-match policies removed/replaced;
- MCP write/delete/export controls fail closed;
- CRM record totals and relationships reconciled;
- Auth, upload, submission, QC/legal, email, payment and revenue flows;
- backup and rollback rehearsal.

### Phase 5 — cutover

Requires explicit approval.

- deploy staging from GitHub;
- run full validation;
- take a final source backup;
- perform a controlled delta migration;
- update environment variables and DNS;
- observe production;
- keep Lovable rollback available;
- only later pause/remove Lovable Cloud.

## Current blockers

1. No compatible `pg_restore` catalogue tool is available in the current workspace.
2. A verified CRM backup has not yet been obtained.
3. Storage object export is separate from the database dump.
4. Auth identity migration scope is unverified.
5. Direct isolated staging capacity is unavailable under the current two-project free limit.
6. Actual import requires separate approval.

## Next safe action

Obtain and verify a backup of `streamvista-crm`, then run source/target catalogue comparison without importing any production data.
