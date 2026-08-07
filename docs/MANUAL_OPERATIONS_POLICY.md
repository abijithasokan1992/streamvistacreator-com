# StreamVista Manual Operations Policy

## Approved automation boundary

Only these eight core automations may remain active or be repaired:

1. Failed email retry.
2. Failed upload recovery.
3. Payment webhook protection and idempotency.
4. Title autosave and resume.
5. Legal/QC status tracking without automatic approval.
6. Role and access security.
7. Audit logging.
8. Important notifications requesting human review.

Everything else requires a separate explicit owner approval before implementation or activation.

## Manual-only actions

The system may provide forms, queues, calculations and status views, but it must not make the final decision for:

- buyer-to-title mapping;
- legal approval or rejection;
- QC approval or rejection;
- contract approval;
- invoice and settlement approval;
- payout approval or execution.

## Removed or deferred automations

These capabilities are intentionally removed from source, disabled from active registration, or queued for explicit unscheduling:

- automatic seller onboarding;
- automatic buyer onboarding;
- automatic buyer matching;
- automatic usage cron outside the approved eight;
- automatic overage charging;
- automatic idle-account reclaim;
- automatic archive-tier movement;
- automatic egress invoice staging;
- automatic stale top-up sweeping;
- automatic OCI multipart cleanup cron;
- automatic intelligence/news snapshot cron;
- automatic title removal or deletion;
- Kammattam Meter, its live polling, realtime subscriptions, pop-out UI and auto-charge control.

## Allowed manual tools

The app may continue to provide non-decisional tools:

- manual admin forms and checklists;
- search, filters and status queues;
- draft calculations clearly marked as estimates;
- warnings for missing information;
- audit logging;
- notifications that request human review;
- explicit Approve, Reject, Assign, Revoke, Retry and Cancel controls;
- upload diagnostics and manually initiated recovery.

## Safety rule

No manual-only or removed action may be converted into an automatic action without:

1. explicit owner approval;
2. success and denial/error tests;
3. role and RLS review;
4. audit-log evidence;
5. a manual kill switch;
6. a rollback plan;
7. production deployment approval.

## Release gate

This cleanup must not be merged or deployed until all of the following are green:

- no imports, routes, buttons, cards or API calls reference removed components or workers;
- typecheck passes;
- focused tests pass;
- production build passes;
- regression, security and accessibility CI provide reviewable evidence;
- the pending unschedule migration is reviewed separately;
- production merge, migration and deploy receive explicit approval.

## Current production status

This branch does not deploy, merge, execute migrations, mutate production data or stop existing production schedules. Existing production behavior remains unchanged until separately approved.