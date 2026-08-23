# StreamVista Private Control Deployment — Zero-Cost Rule

Target host: `control.streamvista.in`

This deployment must not create paid resources, purchase plans, charge cards, buy domains, or increase storage without explicit owner approval.

## Chosen stack

- Frontend hosting: existing Vercel project / free deployment path
- DNS and SSL: existing Cloudflare zone / free DNS proxy
- Database, authentication and storage: existing Supabase project when accessible
- Founder identity: approved official company email
- Source control and CI: GitHub branch `build/prd-v1-frontend-foundation`

Oracle Free Database/Object Storage remains a later migration option. It is not the easiest activation route because the current application already uses Supabase client, auth, storage APIs, RLS and signed URL patterns.

## Deployment Control Tool

Run:

```bash
node scripts/deployment-control.mjs
```

Required environment variables:

```text
APP_URL
FOUNDER_EMAIL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Recommended:

```text
SUPABASE_STORAGE_BUCKET
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ZONE_ID
CLOUDFLARE_RECORD_NAME=control.streamvista.in
CLOUDFLARE_TARGET_HOST=<existing-vercel-hostname>
ALLOW_DNS_WRITE=false
```

The tool is read-only by default. DNS write is possible only when all Cloudflare values are supplied and `ALLOW_DNS_WRITE=true` is deliberately set after owner approval.

## Activation gates

1. App URL is reachable.
2. Supabase Auth endpoint is reachable.
3. Supabase database API is reachable.
4. Configured storage bucket is reachable under its policies.
5. Founder email belongs to an approved company domain.
6. Cloudflare DNS record exists and points to the approved origin.
7. App login, database reads, protected writes, upload, signed download and logout pass in runtime.
8. No production merge until CI and runtime evidence pass.

## hPanel replacement

hPanel is not required for this architecture. The replacement control path is:

```text
GitHub branch
→ Vercel deployment
→ Cloudflare API/DNS
→ Supabase Auth + Database + Storage
→ Deployment Control preflight
```

Gmail and Hostinger Mail remain notification and business communication channels; neither is a hosting control plane.
