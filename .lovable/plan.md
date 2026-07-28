
# StreamVista Production Readiness Program

This is a multi-batch program, not a single change. Each batch ends with a written checkpoint report and an explicit "go / no-go" from you before the next batch starts. Nothing is published, no real payment runs, no data is deleted, and every DB change is reversible.

## Guardrails (apply to every batch)

- Founder / Platform Owner / Super Admin roles preserved; verified before and after each batch.
- No `DROP TABLE`, no bucket deletion, no destructive `DELETE` on business rows. Demo data is tagged, never removed.
- Every migration ships as a pair: forward + rollback, idempotent, quarantined in `supabase/migrations-pending/` until you approve.
- No secrets in the browser bundle or logs. No real Razorpay charges — Test Mode only.
- Each batch produces: files changed, migrations proposed (not applied), tests run, before/after evidence, remaining risks.

## Batch sequence

### Batch 1 — Checkpoint & baseline
- Snapshot: current roles for Founder accounts, list of buckets + policies, list of Edge Functions + secrets (names only), enabled RLS matrix, applied vs pending migrations, current counter values per dashboard.
- Deliverable: `docs/release/BASELINE.md` + role-preservation proof. No code changes.

### Batch 2 — Demo data quarantine (reversible)
- Apply the already-drafted `20260728_quarantine_demo_titles.sql` after review, plus companion tags for related rows (owners, uploads, deals, revenue, emails tied to the 41 titles).
- Wire the existing `src/lib/operations/productionFilters.ts` into `useLiveAdminCounts`, Mission Control, Media Office, Recent Activity, QC/Legal queues, Buyer Mapping, Accounts, Revenue, operational reports.
- Expected result: operational counters read a true zero; quarantined rows visible only in a "Demo & Test" review tab.

### Batch 3 — Admin ↔ Media Office unification
- `/admin` = Founder/Platform Owner home only. Move duplicated overview logic out.
- `/admin/media-office` becomes the department workspace: Movie Desk, Content Quality Review, Rights & Legal, Buyer Mapping, Distribution Readiness, Accounts. All Quick Actions deep-link into these — no parallel business logic.
- New restricted route `Platform → Developer Tools → Backend Details` (Founder-only) hosts Supabase project details, endpoints, RLS guidance, secrets metadata, logs. Removed from Media Office.

### Batch 4 — Live sync & counter reliability
- One shared production-data filter used everywhere.
- Realtime: single channel per surface, teardown on unmount, exponential reconnect, "last known good" + stale badge, explicit Retry Sync, no silent zeroes on failure.
- Add `mission-signals` guard tests for disconnect, reconnect, and stale-state labels.

### Batch 5 — Database readiness audit
- Schema diff vs code expectations: missing columns, mismatched types, FK/cascade gaps, missing indexes, orphan triggers, workflow status enums vs code.
- Every proposed fix arrives as a reversible migration in `supabase/migrations-pending/` with preflight + rollback notes. Nothing auto-applied.

### Batch 6 — Auth & permissions
- End-to-end test matrix (signup, verify, login, logout, reset, magic link/OAuth where enabled, session restore, protected routes, onboarding gate, suspended/deleted users) for Founder, Admin, Staff, Creator, Buyer.
- Confirm RLS + server-side checks agree; UI-hidden buttons never treated as security.

### Batch 7 — Creator & title workflow
- Fix: duplicate titles, repeated metadata prompts, lost autosave, broken resume, upload/state mismatch, wrong quota, no-op buttons, false success toasts.
- Regression tests for draft → upload → submit → send-back → resubmit.

### Batch 8 — Storage readiness
- Audit every bucket (existence, public/private, RLS on `storage.objects`, signed URLs, ownership prefix, MIME/size, multipart/resume, orphan handling, quota calc).
- Investigate the 15 storage alerts; separate demo-generated from real config failures; fix real ones, archive demo ones with reason.

### Batch 9 — Admin review workflow
- QC → Legal → Approval → Ready for Distribution → Release must run without manual DB edits. Enforce valid transitions via RPC + trigger; audit every state change; notify creator on each hop.

### Batch 10 — Buyer & distribution
- Buyer create/access/mapping, catalogue visibility with territory/language/rights filters, offer + deal + agreement linkage, delivery assets, buyer-facing access limits. Remove fake mappings post-quarantine.

### Batch 11 — Accounts, revenue, payments (Test Mode only)
- Revenue import → row mapping → title/buyer matching → allocation → creator/platform split → invoice → approval → payout scheduling.
- Razorpay: signature verification, idempotency, duplicate-charge prevention, refund/failure paths, full audit. No live charges.

### Batch 12 — Email & notifications
- Investigate current failed email(s). Verify: signup, reset, submission, QC/Legal, send-back, approval/release, invoice/payment.
- Bounded retry, DLQ, manual replay, dedupe. Archive demo failures with reason; keep real provider errors visible.

### Batch 13 — Edge Functions & integrations
- Per-function audit: authn, authz, input validation (Zod), error handling, secrets, CORS, rate limits, idempotency, logging, retry safety, DB write permissions.
- Integrations: Supabase, Razorpay, email provider, Oracle Cloud, AI, storage, cron.

### Batch 14 — Security verification
- RLS on every exposed table, service-role usage, storage policies, signed URLs, webhook signatures, billing trigger protections, PII redaction, audit-log access, rate limits, input validation, privilege escalation, Founder-only controls.
- Each finding classified: Confirmed Vulnerability / Confirmed Protected / Accepted Risk / Needs Verification / Fixed and Tested. Documented accepted risks not re-flagged.

### Batch 15 — Remove mocks & fake success states
- Repo-wide sweep: mock data, hardcoded counters, demo accounts, placeholder success responses, fake payment IDs/webhook secrets, sample buyers, local-only fallbacks, buttons without backend action, premature success toasts, debug bypasses.
- Fail-close on unsafe fallbacks; keep only clearly labelled test fixtures.

### Batch 16 — Full test pass
- Typecheck, lint, unit, integration, migration safety, RLS/authz, storage policy, Edge Function, realtime reconnect, payment/webhook, build, route smoke, E2E per role (Founder/Admin/Staff/Creator/Buyer).
- Full production-readiness E2E: Creator signup → onboarding → draft → upload → submit → QC → Legal → approval → buyer mapping → deal → revenue import → invoice → payout-ready. Controlled test records quarantined after.

### Batch 17 — Founder Release Report
Deliverable `docs/release/FOUNDER_RELEASE_REPORT.md` containing every section you listed: issues found/fixed, remaining blockers, accepted risks, migrations required (with preflight + rollback), buckets/policies verified, Edge Functions verified, secrets still required, files changed, tests + exact results, build result, screenshots of critical workflows, before/after counters, role-access matrix, confirmation no real payment occurred, confirmation no production data deleted, deployment + rollback plan.

Final status one of: **PRODUCTION READY / READY WITH ACCEPTED RISKS / BLOCKED**. No publish until you approve this report.

## Clarifications I need before starting Batch 1

1. **Cadence**: proceed batch-by-batch with your approval after each checkpoint (recommended), or run 1–4 together then pause?
2. **Founder accounts to preserve**: confirm the exact user emails/IDs I must never touch (I will read them from `user_roles` and confirm back in Batch 1 if you'd rather).
3. **Real integrations to leave OFF for now**: confirm Razorpay stays Test Mode, real email sending disabled to non-founder addresses during Batches 6–12 (I'll route to a sink or your address).
4. **Quarantine scope**: apply the drafted `20260728_quarantine_demo_titles.sql` as-is in Batch 2, or want a fresh manifest review first?

I'll wait for your answers (or a simple "proceed, batch-by-batch, defaults") before switching to build mode.
