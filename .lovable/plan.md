# Media Office Refactor — Admin Dashboard

Scope: admin dashboard only. Creator RC1, Buyer, Studio, billing, RLS, and edge functions are untouched. Frontend + presentation only — no schema changes, no business-logic rewrites.

## 1. Live data wiring (fix stale counters)

Replace one-shot fetches with a shared `useLiveAdminCounts` hook:

- Subscribes via `supabase.channel('admin-counters').on('postgres_changes', ...)` to `content_titles`, `title_review_assignments`, `title_review_issues`, `distribution_program_offers`, `partner_title_matches`, `deal_memos`.
- On any change, invalidates and refetches the affected counter(s). No polling.
- Counters exposed: `awaitingQc`, `awaitingLegal`, `drafts`, `submitted`, `approved`, `published`, `activeMappings`, `openOffers`, `pendingPayouts`.
- Every counter card shows a small "Live" dot when the channel is subscribed; falls back to "Last updated Xs ago" when the channel drops.
- Cleanup: `removeChannel` on unmount (no leaks).

Failure handling: wrap fetches in try/catch, surface `toast.error("Couldn't refresh <thing>. Retrying…")` and keep the last-known value on screen instead of flashing `0`.

## 2. Language cleanup (plain film-office wording)

Rename in UI copy only (no route or table changes):

| Old | New |
|---|---|
| Ingest Pipeline / Ingest Engine | Movie Vault |
| QC Validation Panel / QC Queue | Quality Check |
| Legal Queue / Legal Clearance | Legal & Agreements |
| Distribution / Partner Mapping | Buyer Mapping |
| Statements / Revenue / Payouts | Accounts & Royalty |
| Readiness Matrix / Platform Readiness | Office Health |
| Titles awaiting QC | Movies waiting for Quality Check |
| Drafts | Unfinished submissions |
| Active Mappings | Buyers currently mapped |

Centralized in `src/lib/admin/labels.ts` so future changes are one-file.

## 3. Four-room sidebar

New `src/components/admin/MediaOfficeSidebar.tsx` replaces the current 6-tab strip in `src/pages/Admin.tsx`:

1. **Dashboard** — Overview + Office Health + Priority Inbox
2. **Movie Desk** — Movie Vault, Quality Check, Legal & Agreements
3. **Buyer Mapping** — Buyers, Offers, Mappings
4. **Accounts** — Invoices, Royalty, Statements

Founder Vault stays hidden from the sidebar (super-admin only, direct route).

Duplicate widgets removed from Mission Control: Priority Inbox appears only under Dashboard; QC/Legal cards live under Movie Desk.

## 4. Title inspection drawer

New `src/components/admin/TitleInspectionDrawer.tsx` — a shadcn `Sheet` opened when any title row is clicked in Movie Desk lists.

Contents:
- **Preview player**: `<video>` on the first available `title_media_versions` entry (trailer preferred, then master).
- **Artwork grid**: posters + banners from `title_assets` where `kind in ('poster','banner','artwork')`.
- **Documents**: `title_ai_licensing_documents` + attached contracts/censor certs, opened via signed URL.
- **Actions** (role-gated): Approve, Send Back (with required reason), Mark Ready. Each calls the existing RPC (`submit_title_to_admin`, `approve_title`, etc.) — no new SQL. Uses `useModalSubmissionLifecycle` for anti-double-submit + 1s success feedback.

## 5. Error safety

- All action handlers wrap awaits in try/catch and surface `sonner` toasts.
- Realtime channels re-subscribe with exponential backoff.
- A single `<AdminErrorBoundary>` around the four rooms shows a plain "Something went wrong — try again" card instead of a blank screen.

## Technical notes

- Files added: `src/components/admin/MediaOfficeSidebar.tsx`, `src/components/admin/TitleInspectionDrawer.tsx`, `src/hooks/useLiveAdminCounts.ts`, `src/lib/admin/labels.ts`.
- Files edited: `src/pages/Admin.tsx` (swap sidebar, remove duplicated widgets), `src/components/admin/QuickActions.tsx`, `src/components/admin/PriorityInbox.tsx`, `src/components/admin/ContentReviewWorkflow.tsx` (labels + row-click drawer wiring).
- Zero database migrations. Zero edge-function edits. Zero RLS changes.
- Smoke tests: `admin-live-counters.test.tsx` (channel subscribe/unsubscribe), `admin-four-rooms.test.tsx` (nav renders 4 items), `title-inspection-drawer.test.tsx` (opens on row click, action buttons gated).

## Out of scope (explicit)

- Creator, Buyer, Studio dashboards — untouched.
- Homepage, landing pages, auth — untouched.
- Any schema, RLS, or edge-function changes — none.
- Renames beyond UI copy — none (routes and table names stay stable).
