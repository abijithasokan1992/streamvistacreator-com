# StreamVista Manual Operations Policy

## Decision

Only the following eight core automations are approved to remain in the product source:

1. Failed email retry.
2. Failed upload recovery.
3. Payment webhook protection.
4. Title autosave and resume.
5. Legal/QC status tracking.
6. Role and access security.
7. Audit logging.
8. Important notifications that request human review.

All other background automations are removed, unscheduled through a pending migration, or deferred until separately approved.

## Manual-only actions

The system may provide forms, queues, calculations and status views, but it must not make the final decision for:

- buyer-to-title mapping;
- legal approval or rejection;
- QC approval or rejection;
- contract approval;
- invoice and settlement approval;
- payout approval or execution.

## Removed or deferred automations

- automatic seller onboarding;
- automatic buyer onboarding;
- automatic buyer matching;
- automatic usage tracking schedules;
- automatic overage charging;
- automatic idle-account reclaim;
- automatic archive movement;
- automatic egress invoice staging;
- automatic stale top-up sweep;
- automatic OCI multipart cleanup sweep;
- automatic intelligence/news snapshots;
- automatic title removal or deletion.

## Allowed manual tools

The app may continue to provide non-decisional tools:

- manual admin forms and checklists;
- search, filters and status queues;
- draft calculations clearly marked as estimates;
- warnings for missing information;
- manual upload diagnostics and cancel/retry controls;
- notifications that request human review;
- explicit Approve, Reject, Assign and Revoke controls.

## Safety rule

No deferred automation may be enabled without:

1. explicit owner approval;
2. success and denial/error tests;
3. role and RLS review;
4. audit-log evidence;
5. a manual kill switch;
6. a rollback plan;
7. production deployment approval.

## Production status

This branch does not deploy or execute the pending cleanup migration. Existing production schedules remain unchanged until separately reviewed and explicitly approved for unscheduling.
