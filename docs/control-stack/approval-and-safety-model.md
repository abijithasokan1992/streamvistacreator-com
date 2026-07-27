# StreamVista Control MCP — Approval and Safety Model

## Goal

The StreamVista Control MCP is a 360-degree full-stack operating layer. It may inspect, plan, propose and—only after explicit approval—execute controlled actions across application code, GitHub, Supabase, storage, payments, delivery, notifications, revenue and operations.

It is not permanently read-only. It is approval-controlled.

## Operating modes

### 1. READ_ONLY
Default mode.

Allowed:
- inspect repository
- inspect schema, RPCs, RLS, routes and edge functions
- inspect logs and health
- run deterministic audits
- generate contradictions and gap reports
- generate P0/P1/P2 plans
- propose migrations and rollback plans

Forbidden:
- code writes
- database writes
- deployment
- production-data mutation
- secret changes
- paid-resource creation

### 2. PLAN_ONLY
Allowed:
- everything in READ_ONLY
- prepare patches
- prepare migrations without executing
- prepare test plans
- prepare PR descriptions
- calculate impact and rollback

Forbidden:
- commit, merge, migration execution, deployment or production mutation

### 3. CODE_CHANGE_APPROVED
Requires explicit user approval for the named task.

Allowed:
- create a dedicated branch
- modify source files
- add tests
- commit reviewable changes
- open a draft PR

Still forbidden without additional approval:
- merge
- deploy
- execute migrations
- mutate production data

### 4. DATABASE_CHANGE_APPROVED
Requires explicit approval naming the migration and target environment.

Allowed only after:
- checkpoint/backup confirmation
- dry-run evidence
- backward-compatibility review
- rollback SQL
- validation queries

Production execution remains separately gated.

### 5. DEPLOY_APPROVED
Requires explicit approval naming environment, commit/PR and deployment target.

Before deployment:
- tests and build must pass
- migration state must be known
- rollback path must be recorded
- secrets must not be exposed

### 6. PRODUCTION_OPERATION_APPROVED
For sensitive operations such as payout, delivery release, access revocation, data import or user-role change.

Requires:
- named operation
- affected entity or scope
- actor identity and role
- preview of impact
- explicit final confirmation
- immutable audit event

## Approval scope

Approval is never global or permanent. It must specify:
- action
- target
- environment
- scope
- expiry or one-time use

Example:

`Approve code changes only for marketplace eligibility audit fixes on branch chatgpt/marketplace-gate. Do not merge or deploy.`

## Non-negotiable prohibitions

The MCP must never:
- expose or commit secrets
- bypass RLS or role checks
- silently change production data
- silently deploy or publish
- execute destructive SQL without explicit approval
- create paid resources without explicit approval
- allow Creator and Buyer to bypass Admin-controlled commercial workflows
- mark a feature complete based only on schema or UI presence

## Full-stack domains

The MCP covers:
- business architecture
- creator workflows
- buyer workflows
- admin operations
- titles and assets
- rights, territory, language and windows
- marketplace eligibility
- screener access
- deal room and negotiation
- agreements and signatures
- invoices and payments
- license activation
- secure delivery
- buyer release tracking
- revenue import and reconciliation
- creator statements and payout
- renewal and expiry
- notifications
- audit logs
- RLS and security
- GitHub, CI and deployment readiness

## Default configuration

```text
DEFAULT_MODE=READ_ONLY
REQUIRE_EXPLICIT_APPROVAL=true
ALLOW_CODE_CHANGES=false
ALLOW_DATABASE_CHANGES=false
ALLOW_DEPLOY=false
ALLOW_PRODUCTION_DATA=false
ALLOW_PAID_RESOURCES=false
ALLOW_SECRET_ROTATION=false
```

These values may be elevated only for one explicitly approved operation.