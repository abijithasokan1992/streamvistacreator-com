# StreamVista Manual Operations Policy

## Decision

Commercial, legal, QC, access, settlement and destructive actions remain manual until each automation is separately approved, tested and documented.

## Manual-only actions

The system may provide forms, queues, calculations and status views, but it must not make the final decision for:

- buyer-to-title mapping;
- legal approval or rejection;
- QC approval or rejection;
- contract approval;
- invoice and settlement approval;
- payout approval or execution.

## Deferred automations

These capabilities are intentionally disabled, removed from active function registration, or deferred:

- automatic seller onboarding;
- automatic buyer onboarding;
- automatic buyer matching;
- automatic overage charging;
- automatic idle-account reclaim;
- automatic title removal or deletion.

## Allowed assistance

The app may continue to provide non-decisional tools:

- manual admin forms and checklists;
- search, filters and status queues;
- draft calculations clearly marked as estimates;
- warnings for missing information;
- audit logging;
- notifications that request human review;
- explicit Approve, Reject, Assign and Revoke controls.

## Safety rule

No manual-only action may be converted into an automatic action without:

1. explicit owner approval;
2. success and denial/error tests;
3. role and RLS review;
4. audit-log evidence;
5. a manual kill switch;
6. a rollback plan;
7. production deployment approval.

## Production status

This branch does not deploy or execute the pending cleanup migration. Existing production schedules remain unchanged until separately reviewed and explicitly approved for unscheduling.
