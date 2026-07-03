
# Stabilization Pass — Wire Existing Modules End-to-End

Reuse the current database, edge functions, routes, and components. No new tables. No redesign. Hide incomplete surfaces instead of stubbing them.

## Scope (in order)

### 1. Reviewer consoles (QC + Legal) — `/admin/qc`, `/admin/legal`
Today both paths render the generic `Admin` shell. Replace the tab body for these two paths with a real reviewer console backed by existing tables:
- `title_review_assignments` → assignment queue for the signed-in reviewer
- `title_review_checklist` → checklist items (kind = qc | legal)
- `title_review_issues` → raise/track issues
- `title_review_notes` → reviewer notes
- `content_approvals` → record approve / request-changes / reject
- `content_titles.status` → advance status (`in_qc` → `in_legal` → `approved`)

Reuse existing `src/lib/review/checklists.ts` and admin console layout components. Gate with `isQcReviewer` / `isLegalReviewer` (already in `useAuth`).

### 2. Creator → QC → Legal → Licensing chain
Wire the transitions already implied by the schema:
- Creator "Submit for review" button on existing title editor → sets `content_titles.status='in_qc'`, inserts `title_review_assignments` row for QC pool.
- QC approve → status `in_legal`, reassign to legal pool.
- Legal approve → status `approved`, unlock rights-availability + deal-memo surfaces.
- Reject / request-changes → status `changes_requested` with note visible to creator dashboard.

All via existing tables; no schema changes. Realtime subscription on `content_titles` so Admin sees live status.

### 3. Buyer acquisition surface — reuse `BuyerDashboard`
Add three panels to the existing Buyer dashboard (no new routes):
- **Browse catalog** — `content_titles` where `status='approved'` + `title_commercial_profiles`
- **Request screener** — insert into `screening_invites` (existing table), triggers existing `mint-screening-par` function
- **Submit acquisition request** — insert into `acquisition_requests` (existing table)

Admin already has the reverse side; verify it renders these rows.

### 4. Uploader consolidation
Keep `SmartDropUploader`. Migrate the two call sites of `UploadManager` (Vault flows) to render `SmartDropUploader` with the same target bucket/prefix props. Leave `UploadManager.tsx` file in place but unused until we confirm no regressions in Oracle multipart, resumable, checksum. Do not delete yet.

### 5. Hide, don't stub
- Dormant role dashboards (`/dashboard/localization`, `/dashboard/distribution`) — already redirect; leave.
- Empty admin tabs with no data source → hide the tab trigger rather than showing a placeholder.
- Founder Vault already cleaned; verify nothing references removed passphrase RPCs.

## Explicitly out of scope this pass
- No new tables, RLS policies, or edge functions.
- No visual redesign; reuse shadcn components already in the project.
- No College ERP / Oracle APEX / dormant role removals (user said not yet).
- No transcode/proxy pipeline, delivery packaging, notification center, marketing CMS — deferred.

## Technical notes
- Reviewer consoles live at `src/components/admin/reviewer/QcConsole.tsx` and `LegalConsole.tsx`, mounted from `Admin.tsx` when `pathToTab` returns `qc` / `legal`. Reuse existing `AdminErrorBoundary` and admin layout.
- Status transitions go through a single helper `src/lib/review/transitions.ts` (new file, no schema change) so Creator / QC / Legal / Admin all call the same function.
- Realtime: enable publication on `content_titles`, `title_review_assignments`, `content_approvals` via migration (publication only — no table changes).
- Buyer panels reuse `src/components/shared/tools/*` (QuickActionCard, StatusSummaryCard).
- Every new query respects existing RLS; if a query fails permission-denied I'll surface the exact `GRANT` needed rather than loosening policy silently.

## Verification
- `bunx vitest run` for smoke tests (`reviewer-routing`, `workflow-presence`, `user-journey`).
- Playwright walk: creator submit → QC approve → legal approve → buyer requests screener → admin sees updated status. Screenshots at each step.
- Confirm no console errors and no 404/WrongPortal for the 7 MVP roles.

## Deliverable
One PR-sized change set touching ~10-15 files, no schema DDL beyond the realtime publication add.
