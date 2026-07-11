# StreamVista Domain Model — JSON Schemas

Reference JSON Schema (draft-07) definitions for the StreamVista Cloud Studio OS
domain model. These schemas describe the canonical shape of core business
objects and are used as contracts for APIs, ingest pipelines, and
integrations. They are **not** a 1:1 mirror of the database — the live
Postgres schema may store additional operational columns.

## Objects

| Schema file | Purpose |
| --- | --- |
| `organization.json` | Studio, production house, or broadcaster tenant |
| `user.json` | Authenticated user (identity, profile, RBAC assignments) |
| `role.json` | Named role (Super Admin, Studio Owner, DIT, Editor, Producer, …) |
| `project.json` | Production or campaign container |
| `media-asset.json` | Master media metadata (canonical asset record) |
| `ingest-job.json` | Upload, checksum, and processing pipeline run |
| `qc-report.json` | Automated and manual quality-control results |
| `storage-object.json` | Cloud storage reference (bucket, key, region) |
| `licensing-contract.json` | Rights, territories, and license terms |
| `distribution-delivery.json` | OTT / broadcaster delivery record |
| `buyer.json` | Content-acquisition company |
| `offer.json` | Licensing negotiation / offer round |
| `invoice.json` | Billing and payment document |
| `subscription.json` | SaaS plan and renewal state |
| `audit-log.json` | Security and compliance audit entry |
| `notification.json` | Email, SMS, or in-app alert |
| `api-key.json` | External integration credential (metadata only) |
| `workflow.json` | Approval / publishing state machine definition |

## Conventions

- `$id` uses `https://streamvista.com/schema/<name>.json`.
- All top-level objects require `id`, `createdAt`, and (where applicable)
  `updatedAt` ISO-8601 timestamps.
- Identifiers are UUID v4 strings unless the object represents an external
  resource (e.g. Storage Object keys).
- Enums are closed sets — extend only via schema version bumps.
- `additionalProperties: false` is used on top-level objects to keep the
  contract strict; nested sub-objects may relax this where a provider-specific
  payload is expected.
- Dates use `format: date`; timestamps use `format: date-time`.

## Versioning

Schemas are versioned via the `$id` URL path. Breaking changes bump the path
segment (`/v2/`) and are announced in the platform changelog.
