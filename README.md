# StreamVista — Main Business Application

This repository is the canonical end-user business application for StreamVista and Crayons Bridge.

It owns the complete content licensing and distribution workflow used by creators, buyers, administrators and operations teams.

## Canonical responsibility

This repository owns:

- Authentication and user sessions
- Creator onboarding and title submission
- Film, series and documentary metadata
- Rights, territories, languages and licensing models
- Media upload, storage references and screeners
- QC and legal review workflows
- Buyer marketplace and buyer access
- Deal rooms, negotiations and agreements
- Delivery, release tracking and reporting
- Revenue reconciliation, statements and payouts
- Creator, buyer and admin portals

## Control-plane relationship

The operational control plane is:

```text
abijithasokan1992/streamvista-cloud-x
```

Cloud X may monitor deployments, health, errors, infrastructure and registered modules. It must not become a second copy of these business workflows.

This application may expose narrowly scoped, authenticated operational endpoints for Cloud X. Those endpoints must be read-only by default, audited and owner-approved for destructive actions.

## Explicit boundary

Deployment inventory, provider controls, duplicate detection, incident monitoring, agent orchestration and founder-wide system controls belong in `streamvista-cloud-x`, not here.

## Isolation rule

Union Auto Spares is a separate business system. No Union Auto Spares code, database, storage, authentication, inventory, billing or deployment configuration belongs in this repository.

## Change rule

Before adding a feature:

1. Confirm it is an end-user business workflow.
2. Search for an existing canonical implementation before creating another one.
3. Do not add deployment-control or infrastructure-control screens here.
4. Keep one source of truth for each workflow.
5. Verify build, authentication and the affected workflow before marking work complete.

## Development

Use the existing package scripts in this repository. Never replace real authentication with temporary in-memory authentication in production.
