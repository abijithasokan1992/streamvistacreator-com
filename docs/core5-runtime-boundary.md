# StreamVista Core 5 Runtime Boundary

This repository currently hosts four canonical StreamVista product surfaces in one production application. Until physical repo/app separation is proven safe, treat these as strict logical boundaries and release them together through one verified build.

## Canonical runtime surfaces

1. **StreamVista Website** — public marketing, legal, pricing, contact and content-submission routes.
2. **Creator Cloud** — authenticated creator/content-owner/studio workflows, including `/creator/*` and creator/studio dashboards.
3. **Buyer Portal** — authenticated buyer workflow rooted at `/dashboard/buyer` plus buyer marketplace/request/delivery modules.
4. **Admin Console** — admin surface rooted at `/admin/*`, shared through the canonical `ADMIN_ROUTES` source of truth.
5. **Cloud X** — separate repository: `abijithasokan1992/streamvista-cloud-x`; it must not be merged into this runtime.

## Explicitly outside this runtime

- College ERP / Oracle APEX ERP
- AI Workforce
- AI Dubbing Studio
- unrelated experiments, demos and prototype products

Historical files may remain temporarily for evidence or migration, but they must not render as active StreamVista product functionality or become release dependencies.

## Current compatibility rule

The historical `/college-erp` route is retained only to avoid breaking old bookmarks. It must redirect to the StreamVista home route and must not render the legacy ERP application.

## Release gates

A Core 5 release is not green unless all of the following are independently verified:

- `npm ci` succeeds from the committed lockfile.
- production build succeeds.
- regression tests succeed, including `core5-runtime-boundary.test.ts`.
- Semgrep is green.
- npm audit high/critical gate is green.
- OSV dependency scan is green.
- CodeQL is green where enabled.
- deployment health check returns the expected application shell and bundle.
- no production database, auth, storage, payment or DNS mutation is performed solely to make CI pass.

## Merge rule

`main` remains the production source of truth. Cleanup branches and security-remediation branches remain isolated until their checks are green. In particular, PR #101 must remain open and unmerged until Semgrep, npm audit and OSV are independently verified green together with regression/build evidence.
