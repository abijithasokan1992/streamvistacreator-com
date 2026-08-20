# StreamVista Oracle Free DB + Storage Setup

## Decision

Use Oracle Cloud Free Tier only where it helps without creating a paid dependency:

- Frontend hosting: existing Vercel preview / Cloudflare subdomain
- Authentication: existing Supabase Auth for now
- Application API: existing Supabase Edge/API for now
- Large media files: Oracle Cloud Object Storage
- Oracle Database: connect only through a server-side ORDS/API layer

The browser must never receive Oracle database credentials, OCI private keys, tenancy OCIDs, user OCIDs, or service credentials.

## Why not host inside Gmail, Hostinger Mail, ChatGPT, WhatsApp, Meta, or Perplexity?

Those are communication or application platforms, not general-purpose hosting for this React/Vite app. They may receive notifications, links, or embedded experiences, but they do not replace the app host, database API, authentication, or object storage.

## Existing repository support

The repository already contains OCI multipart upload functions and browser upload flows. Reuse them instead of creating a second storage implementation:

- `supabase/functions/oci-multipart/index.ts`
- `supabase/functions/oci-upload/index.ts`
- existing upload session and ingest telemetry tables

## Read-only control tool

Run:

```bash
node scripts/oracle-free-control.mjs
```

Required Object Storage environment variables:

```text
OCI_TENANCY_OCID
OCI_USER_OCID
OCI_FINGERPRINT
OCI_PRIVATE_KEY or OCI_PRIVATE_KEY_PATH
OCI_REGION
OCI_NAMESPACE
OCI_BUCKET or OCI_BUCKET_NAME
```

Optional Oracle Database/ORDS verification:

```text
ORACLE_ORDS_HEALTH_URL
ORACLE_ORDS_BEARER_TOKEN
```

The tool checks:

1. Required OCI configuration is present.
2. OCI signed namespace request succeeds.
3. The configured bucket is reachable.
4. An optional ORDS/API health endpoint responds.
5. No paid or provisioning flags are enabled.

## Hard zero-cost protection

The tool does not:

- create an Oracle account
- create Autonomous Database
- create or resize Object Storage
- enable paid services
- upgrade Vercel, Cloudflare, Supabase, or Oracle
- charge a card
- delete or modify cloud resources

It exits immediately if any of these flags are enabled:

```text
ALLOW_CREATE_ORACLE_RESOURCE
ALLOW_ORACLE_UPGRADE
ALLOW_PAID_ACTION
ALLOW_CARD_CHARGE
```

## Oracle login blocker

Oracle sign-in, MFA, tenancy selection, API key generation, bucket creation, and Autonomous Database credentials require the account owner to complete Oracle's protected login flow. Do not paste the OCI private key or database password into chat, source code, GitHub, or any `VITE_*` environment variable.

After login, collect only these non-secret identifiers for configuration:

- tenancy OCID
- user OCID
- API key fingerprint
- region
- Object Storage namespace
- existing bucket name

Store the private key only in the server-side secret manager used by the deployment runtime.

## Activation gates

The private control site is not production-ready until all are verified:

- official founder login: `abijithasokan@crayonspictures.com`
- private subdomain DNS and SSL
- app authentication and role enforcement
- database API health
- OCI bucket health
- signed upload and download
- RLS/tenant access rules
- email/CRM/payment read-only integration health
- complete runtime smoke test

## Safe transition plan

1. Keep existing Supabase database/auth running.
2. Verify Oracle Object Storage with the read-only tool.
3. Route only new large media uploads to OCI.
4. Keep metadata, rights, deals, and access-control records in Supabase initially.
5. Build and verify an Oracle ORDS/API adapter before considering database migration.
6. Migrate database data only after parity, rollback, and backup tests pass.

This avoids breaking the current application while using the Oracle free resources already owned by the company.
