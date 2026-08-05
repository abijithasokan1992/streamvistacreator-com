# StreamVista Deployment Control

Admin-only hosting console at `/admin/deployments`. All provider access goes
through the `vercel-admin-proxy` Supabase Edge Function — the browser never
receives a Vercel token.

## Required secrets (Project Settings → Secrets)

| Secret | Required | Purpose |
| --- | --- | --- |
| `VERCEL_TOKEN` | Yes | Vercel REST API access token used server-side only. |
| `VERCEL_TEAM_ID` | Optional | Needed only when the projects live under a Vercel **team** rather than a personal account. |

Until `VERCEL_TOKEN` is present the page shows **“Vercel not connected”** and
names the missing secret. Values are never displayed or logged.

## Least-privilege token guidance

1. Create the token in Vercel → Account Settings → Tokens.
2. **Scope it to the single team/account** that owns the StreamVista projects —
   never an org-wide "all teams" token.
3. Set the shortest practical expiry (90 days) and rotate on schedule.
4. Store it only as a Supabase Edge Function secret. Do not add it to `.env`,
   `VITE_*` variables, or the repository.
5. Rotate immediately if any admin with console access leaves the team.

## Supported actions (server allow-list)

Read: `status`, `list_projects`, `list_deployments`, `get_project`,
`get_deployment`, `list_domains`, `health_check`.

Write: `set_protection` (SSO protection ON/OFF), `redeploy`, `add_domain`,
`remove_domain`.

Destructive: `delete_deployment`, `delete_project` — both require a typed
confirmation phrase matching the exact id/name, a second confirmation dialog in
the UI, and are rate-limited to 3 destructive calls per admin per 5 minutes.

Any other action is rejected with `400 Unsupported action`.

## Access control

The function requires a Supabase JWT whose user holds the `admin` or
`super_admin` role (checked via the existing `public.has_role` RPC). The page
itself is guarded by the standard admin route protection.

## Audit trail

Every write/destructive action is recorded in `public.deployment_audit_log`:
actor user id and email, action, project/deployment id, before/after protection
state, result, request id, and a sanitized error summary. Tokens and secrets are
never stored. Admins can read the table; only the server can write to it.
