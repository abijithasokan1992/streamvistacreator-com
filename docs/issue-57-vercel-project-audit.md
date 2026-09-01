# Issue #57 — Vercel Project Duplication Audit

Date: 2026-08-02

## Objective

Audit Vercel projects connected to `abijithasokan1992/streamvistacreator-com` and select one canonical StreamVista project to stop duplicate builds and deployment checks.

## Audit scope and safety gate

- Audit-only task.
- No project, deployment, environment variable, domain, integration, branch, DNS, or production resource was changed or deleted.
- No build was triggered by this audit work.

## Evidence reviewed

From commit-check evidence on PR `#55` (`5091be11...`) and PR `#56` (`d0b761d8...`), the same repository/commit is wired to multiple Vercel project contexts:

1. `streamvistacreator-com`
2. `streamvistacreator-com-hxvz`
3. `streamvistacreator-com-h3kr`
4. `streamvistacreator-com-zvrc`
5. `frontend-next`

Observed behavior:

- All project-level Vercel checks failed against the same `build-rate-limit` target.
- The aggregate Vercel deployment check remained pending.
- This indicates one GitHub push/PR can fan out into multiple Vercel build attempts for equivalent code.

Repository verification:

- `main` contains no tracked `VERCEL_URL` reference in source.
- Duplicate linkage is most likely configured in Vercel ↔ GitHub integration/project settings, not in application code.

## Canonical project recommendation

Recommend **`streamvistacreator-com`** as the canonical Vercel project for this repository.

Rationale:

- It matches the repository/domain naming baseline.
- It keeps naming consistent for dashboards, checks, and operational ownership.
- The current duplicate project links are causing avoidable build-rate pressure and noisy check status.

## Approval criteria (for follow-up execution outside this repository)

Before enforcing a single project link, confirm in Vercel dashboard:

1. `streamvistacreator-com` owns the production domain mapping.
2. Environment variables and branch settings are complete on `streamvistacreator-com`.
3. Duplicate projects (`-hxvz`, `-h3kr`, `-zvrc`, `frontend-next`) are detached from this GitHub repo after migration checks.

Once confirmed, keep only the canonical GitHub integration path to prevent repeated parallel builds.
