# Production Readiness Pass

Reuses the existing pipeline. Adds one server-side gate, one checklist doc, and a small test file. No schema changes, no duplicate business logic.

## 1. Regression checklist (doc)

Create `.lovable/production-readiness.md` with a Pass/Fail row for each area, populated from static analysis of the current codebase and pointers to the exact file/line evidence a reviewer would use to re-verify on the live URL:

- Studio onboarding · Active Production · Studio Ingest · Storage allocation · Razorpay activation · OCI upload · Proxy generation · Production Media · Activity sync

For each row: current status (Pass / Needs Live Check), what code guarantees it, and the shortest reproduction path (URL + click sequence). Live-only checks (Razorpay live-mode order, real OCI PAR mint) stay marked "Needs Live Check" — the doc tells the reviewer exactly what to click.

## 2. Server-side ingest preflight (new edge function)

New function `supabase/functions/ingest-preflight/index.ts`:

- Reads bearer token, resolves `auth.uid()`, rejects unauthenticated with `AUTH_REQUIRED`.
- Validates body `{ workspace_id, project_id? }` with Zod.
- Runs the same checks as the existing RLS policy but returns structured JSON instead of a raw RLS error:
  - `WORKSPACE_ACCESS_DENIED` — no workspace_members row.
  - `INSUFFICIENT_ROLE` — role not owner/admin.
  - `PREMIUM_REQUIRED` — `has_premium_storage_entitlement()` false and not global admin.
  - `STORAGE_REQUIRED` — active `workspace_storage_entitlements` row missing.
  - `INVALID_PRODUCTION` — project_id present but not in workspace.
- Never leaks internal SQL errors — maps unknown failures to `PREFLIGHT_FAILED`.
- Structured console.log lines: `{"level":"warn","event":"ingest_preflight_denied","reason":"PREMIUM_REQUIRED","workspace_id":"…","user_id":"…"}`.

`supabase/config.toml` gains `[functions.ingest-preflight] verify_jwt = false` (we validate in-code, standard pattern for this repo).

## 3. Wire preflight into `StudioIngest`

In `startIngest`, call `supabase.functions.invoke("ingest-preflight", …)` before inserting into `ingest_sources` / `ingest_jobs`. On non-OK:

- Toast the friendly message returned by the function.
- If reason is `PREMIUM_REQUIRED` or `STORAGE_REQUIRED`, open the existing storage paywall via `quota.checkOrPaywall()`.
- Log a client-side telemetry breadcrumb via the existing `paymentTelemetry`/`uploads/uploadFailure` helper (no new lib).

Existing client-side eligibility banner stays as UX; the server call is the real gate.

## 4. Tests

Add `src/test/smoke/ingest-preflight.test.ts` — a unit test that mocks `supabase.functions.invoke` and asserts:

- `startIngest` short-circuits and toasts when preflight returns `PREMIUM_REQUIRED`.
- Successful preflight proceeds to insert.

Add `src/test/smoke/studio-onboarding.test.tsx` covering the two regressions from the previous fix:

- `isStudioOnboarded()` returns true for a completed profile → gate renders children.
- Wizard reads `useWorkspaces().activeId` so gate/wizard target the same workspace.

Live e2e (Playwright against the deployed URL) is intentionally out of scope for this change — the checklist doc gives the reviewer the click paths.

## Files touched

- Create `.lovable/production-readiness.md`
- Create `supabase/functions/ingest-preflight/index.ts`
- Edit `supabase/config.toml` (add function entry only)
- Edit `src/components/studio/ingest/StudioIngest.tsx` (call preflight in `startIngest`, map reason codes)
- Create `src/test/smoke/ingest-preflight.test.ts`
- Create `src/test/smoke/studio-onboarding.test.tsx`

## Out of scope (per your rules)

- No changes to `ingest_jobs` RLS, `entity_profiles`, or any schema.
- No new tables, no new columns, no data migration.
- No changes to Razorpay, OCI, or proxy-generation code paths.
- No new upload pipeline — preflight sits in front of the existing one.
