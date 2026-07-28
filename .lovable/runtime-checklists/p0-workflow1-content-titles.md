# P0 Workflow 1 — `content_titles` Creator Ownership & Draft-Resume

**Status:** `BLOCKED` (pending two authenticated non-admin creator/studio identities).  
**Reclassified baseline:** `public.contact_messages` onboarding attribution = `PASS`.

---

## Evidence already collected

| Item | Result | Detail |
|------|--------|--------|
| Public onboarding form | PASS | Row `ae42703e-69ab-4751-a830-c3d8bcc93e70` in `public.contact_messages`; `user_id = 7119278d-c8f5-42bc-8dc4-077198eea87f`; email `abijithasokan1992@gmail.com`; source `public_content_submission:whatsapp_onboarding`. |
| Unauthorized read | PASS | Anonymous PostgREST GET returned `42501 permission denied for table contact_messages`. |
| Smoke tests | PASS | `bunx vitest run src/test/smoke/batch-a-repairs.test.ts` → 8/8 passed. |

---

## Prerequisites still required

1. **Identity A — non-privileged creator or studio user**
   - Must be a real existing StreamVista test account.
   - Must have **only** creator/studio-tier roles (e.g., `creator`, `studio`, `content_owner`, `studio_owner`, `studio_manager`, `studio_uploader`).
   - Must **not** have `admin`, `super_admin`, `founder`, or `platform_owner`.
   - Must have a workspace/studio membership (`workspace_members.workspace_id` and `role` in `{owner, admin, editor}`).
   - Must be able to sign in with email + password (or a magic link), because the draft-resume step requires a real sign-out → sign-in cycle.

2. **Identity B — second distinct non-privileged authenticated user**
   - Same role constraints as Identity A.
   - Must belong to a different workspace/studio, or at least a different account, so the negative access test is meaningful.
   - Needed to attempt to read, open, update, or resume Identity A's title through the UI and direct API.

3. **No code/schema/RLS changes**
   - The test must run against the current `main` branch state.
   - No migrations, no role edits, no policy relaxations.

---

## Exact UI routes and actions

### Identity A — Create and resume a title

1. **Navigate** to the canonical creator dashboard:
   - Creator account: `https://streamvista.in/dashboard/content`
   - Studio account: `https://streamvista.in/dashboard/studio`
2. **Open the Titles section** inside the dashboard. The active component is `MyTitlesSection` (`src/components/creator/sections/MyTitles.tsx`).
3. **Click the primary create button** (e.g., "New Title" / "Add Title").
   - On free tier, if a draft already exists, the UI may reopen it automatically; for this test, use a paid or fresh test account so the create path is exercised.
4. **Enter a clearly labelled test title** in the Details step of `TitleEditor`, e.g.:
   - Title: `P0W1-CT-TEST-<unixtimestamp>`
   - Use a unique, grep-safe slug so the row is recoverable.
5. **Allow autosave** or manually save.
   - `TitleEditor` autosaves via `titleApi` helpers and writes to `public.content_titles`.
6. **Record** the returned `content_titles.id` (from the UI or from the network tab after the first insert).
7. **Sign out** through the UI (`/auth` or the account menu).
8. **Sign back in** as Identity A with real credentials.
9. **Navigate again** to `/dashboard/content` (or `/dashboard/studio`).
10. **Open the same title** from the My Titles list.
11. **Verify** the editor loads the existing row (same `id`, same timestamp label) and does **not** create a duplicate.

### Identity B — Negative access test

1. **Sign in as Identity B** (different non-admin user/workspace).
2. **Navigate** to `/dashboard/content` or `/dashboard/studio`.
3. **Attempt to open the same title** by ID if possible, or verify the title does not appear in the list.
4. **Direct API attempt** (optional but recommended): with Identity B's bearer token, call:
   ```http
   GET /rest/v1/content_titles?id=eq.<title_id>
   ```
   and/or attempt to update the row.
5. **Capture the denial response** (expected: `404` or `42501` / permission denied depending on RLS policy).

---

## Database evidence to collect

```sql
SELECT
  id,
  owner_user_id,
  workspace_id,
  status,
  client_draft_id,
  title,
  created_at,
  updated_at
FROM public.content_titles
WHERE title ILIKE '%P0W1-CT-TEST%'
ORDER BY created_at DESC;
```

Also verify:

- `owner_user_id` matches Identity A's `auth.users.id`.
- `workspace_id` is the active workspace of Identity A.
- No ownership column is NULL.
- No field points to Identity B or a different workspace.

Check workspace membership:

```sql
SELECT user_id, workspace_id, role
FROM public.workspace_members
WHERE user_id = '<identity-a-uuid>';
```

---

## Audit/history evidence to collect

If `title_audit_log` or `content_title_history` rows are created during the workflow, capture:

- Insert audit row(s) tied to `title_id` and `user_id`.
- Update audit row(s) after resume/edit.
- No audit row attributed to Identity B for this title.

Query template:

```sql
SELECT *
FROM public.title_audit_log
WHERE title_id = '<title_id>'
ORDER BY created_at;
```

---

## Duplicate check after resume

After the sign-out / sign-in / resume cycle, run:

```sql
SELECT
  id,
  title,
  created_at,
  updated_at,
  owner_user_id
FROM public.content_titles
WHERE title ILIKE '%P0W1-CT-TEST%'
ORDER BY created_at;
```

**Expected:** exactly one row with the same `id`, and an `updated_at` later than the original `created_at`.

---

## Cleanup / quarantine decision

- Do **not** delete the test row unless a `super_admin` / service-role migration is approved.
- Preferred approach: tag the test row in place with a known label (e.g., `P0W1-CT-TEST-<timestamp>` in `title` and/or `metadata` JSONB) so it can be excluded from production queries and later quarantined via the `is_demo` / `demo_tag` mechanism already in `productionFilters.ts`.
- If the existing `20260728_quarantine_demo_titles.sql` migration pattern is used, the test row can be added to the demo/quarantine set without data loss.

---

## Pass / fail criteria

| # | Criterion | Pass condition |
|---|-----------|---------------|
| 1 | Authenticated title creation | Title row created in `public.content_titles` from the real UI. |
| 2 | Owner attribution | `owner_user_id = Identity A` and not NULL. |
| 3 | Workspace attribution | `workspace_id` matches Identity A's active workspace. |
| 4 | No cross-user leakage | No ownership field points to another user or workspace. |
| 5 | Draft resume | After sign-out/sign-in, same `id` is reopened, not duplicated. |
| 6 | Unauthorized access denied | Identity B cannot read, open, or update the title; actual denial response captured. |
| 7 | Audit trail | Any audit/history rows correctly attribute activity to Identity A only. |
| 8 | No policy changes | No RLS, RPC, auth, role, or schema changes were made during the test. |

---

## Relevant source files (read-only reference)

- `src/components/creator/sections/MyTitles.tsx` — list + create entrypoint.
- `src/components/creator/title/TitleEditor.tsx` — 5-step editor/autosave.
- `src/lib/creator/titleApi.ts` — create/read/update helpers.
- `src/lib/creator/titleNormalization.ts` — canonical/metadata sync.
- `src/hooks/useAuth.tsx` — role-based dashboard routing.
- `src/App.tsx` — routes: `/dashboard/content`, `/dashboard/studio`.

---

## Blocked until

- [ ] Identity A (non-admin creator/studio) credentials provided.
- [ ] Identity B (second non-admin creator/studio) credentials provided.
- [ ] Approval to perform a real sign-out / sign-in cycle for Identity A.
- [ ] Approval to create a reversible test title in `public.content_titles`.

Workflows 2–4 (QC → Legal, Failed Email Retry, DIT Ingest) are **not started** and remain queued behind Workflow 1.
