# StreamVista Independent AI Gateway

Status: architecture checkpoint only. Not deployed. No production data, DNS, OAuth, database, storage, or secrets changed.

## Outcome

Build a GitHub-controlled MCP gateway that lets ChatGPT, Claude, and future white-label assistants call StreamVista tools without Lovable being a runtime dependency.

Target path:

```text
ChatGPT / Claude / customer assistant
              |
            OAuth 2.1
              |
StreamVista Independent MCP Gateway
              |
server-side authorization + audit + kill switch
              |
owner-controlled Supabase/API/storage
```

Lovable may remain an optional design tool, but it must not be required for authentication, MCP routing, hosting, database access, or deployment.

## Confirmed repository foundation

The repository already contains:

- an MCP governance client in `src/lib/mcpClient.ts`;
- shared server authorization, redaction, rate limiting, JWT-scoped Supabase access, and audit helpers in `src/lib/mcp/lib/control.ts`;
- fail-closed defaults for database writes, storage writes, and user-data exports;
- MCP-related dependencies `@lovable.dev/mcp-js` and `@lovable.dev/cloud-auth-js`.

The existing foundation should be extracted and adapted. Do not create a second StreamVista database or duplicate production application.

## Portability blockers

1. The current backend is Lovable-managed and must be migrated to an owner-controlled backend.
2. MCP runtime/auth code still references Lovable packages.
3. Production OAuth issuer, redirect URIs, client registration, and token audience must be re-established under owner-controlled infrastructure.
4. Existing security findings must be repaired before exposing user-facing assistants.
5. Production secret values are not in GitHub and must be configured through the target host's secret store.
6. The existing database export, storage objects, Auth identities, Edge Functions, Jobs, and configuration require separate migration validation.

## Initial tool surface

Release 1 is authenticated and read-only:

1. `who_am_i`
2. `list_my_capabilities`
3. `search_my_titles`
4. `get_submission_status`
5. `get_upload_requirements`
6. `get_platform_health`

Do not expose raw SQL, arbitrary table reads, secret retrieval, signed URLs, private storage paths, PII, payment identifiers, or unrestricted export tools.

## Access model

| Caller | Initial access |
|---|---|
| Platform Owner / Founder / Super Admin | Complete authorised read visibility; high-risk tools remain off |
| Admin | Permission-scoped operational reads |
| Finance | Finance-scoped reads with sensitive fields redacted |
| QC / Legal / Support | Queue and workflow-scoped reads |
| Creator / Buyer | Own workspace and ownership-scoped reads |
| Authenticated without role | Deny private data |
| Anonymous | Public metadata only, if a separate public server is explicitly approved |

Owner access must be verified from evidence; it must never be assumed or silently changed.

## High-risk controls

Create, update, delete, publish, QC/legal transitions, email sending, payments, database writes, storage writes, maintenance, and user-data exports remain disabled until a later approved release.

Every high-risk action must require:

- an authenticated permitted role;
- workspace/ownership validation;
- an enabled per-action control flag;
- master kill switch OFF;
- explicit user confirmation;
- correlation ID and complete audit record;
- bounded input/output and redaction;
- success, denial, and error tests.

## Security repairs required before external activation

- replace JWT email-match ownership checks with verified identity ownership;
- scope creator revenue by active workspace;
- restrict personal branding assets under `users/*`;
- correct the `members` restrictive-policy conflict;
- repair missing actor, permission, reason, and action fields in MCP audit records;
- verify all MCP tools call server-side authorization;
- remove schema-drift failures from team, CRM, revenue, submission, QC/legal, and upload workflows.

## Provider-independent implementation

The gateway should be a separate server package or service with:

- standard MCP transport;
- OAuth 2.1 protected-resource metadata;
- OIDC discovery and asymmetric JWT verification;
- PKCE S256 and dynamic-client-registration support only when required;
- an adapter interface for identity, authorization, audit, database, and storage;
- no frontend service-role credentials;
- environment-variable names documented without values;
- local test doubles and a non-production integration environment.

Select the final runtime only after a local build and compatibility test. A free-compatible runtime may be used for staging, but production capacity, security, logs, and rollback must be reviewed separately.

## Delivery phases

### Phase 1 — extraction and local tests

- inventory every existing MCP tool;
- isolate Lovable-specific imports;
- define provider-neutral interfaces;
- implement the six read-only tools;
- add role, workspace, redaction, timeout, and denial tests;
- run typecheck, focused tests, full tests, and build.

### Phase 2 — owner-controlled staging

Requires explicit approval before connecting real infrastructure:

- create/configure the owner-controlled backend;
- restore only to staging first;
- configure secret names through the host secret store;
- deploy the gateway to a temporary staging URL;
- validate OAuth discovery and protected-resource metadata;
- test Creator, Buyer, Admin, Owner, no-role, and anonymous denial paths.

### Phase 3 — external assistants

Requires explicit approval:

- register the gateway in ChatGPT/Claude;
- allow only the reviewed read-only tools;
- monitor audits and error rates;
- conduct privacy and cross-workspace isolation tests.

### Phase 4 — controlled writes and white-label

Only after the read-only release is stable:

- add low-risk draft/task tools;
- add customer branding and tenant configuration;
- introduce high-risk actions one at a time behind confirmation and kill-switch controls;
- publish a commercial white-label package with subscription, usage, support, and dedicated-instance options.

## Approval gates

Do not deploy, publish, change DNS, connect production OAuth, import production data, restore the export, mutate RLS, rotate secrets, enable write/delete/export tools, create paid resources, or remove Lovable Cloud without separate explicit approval.

## Current repository branch

Implementation work begins on `chatgpt/independent-mcp-gateway`. The default `main` branch remains unchanged until review and approval.
