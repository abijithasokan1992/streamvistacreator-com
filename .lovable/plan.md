# Media Office → Title Workspace

Goal: replace the small `TitleInspectionDrawer` with an enterprise-grade **Title Workspace** that lets an Admin run the full lifecycle (QC → Legal → Rights → Buyer Mapping → Marketplace → Deals → Revenue) without leaving the surface. **Reuse-first.** No DB schema changes. No new business logic. No mock data.

---

## Phase 0 — Audit (reuse-first inventory)

Confirmed reusable building blocks already in the repo:

| Concern | Existing component / API |
|---|---|
| Title header + status | `TitleInspectionDrawer.tsx`, `content_titles` query |
| QC + Legal actions | `QCLegalValidationSurface.tsx`, `TitleReviewPanel.tsx` |
| Commercial state / marketplace | `TitleCommercialOpsConsole.tsx` + `admin_set_title_commercial_state` RPC |
| Buyer mapping | `BuyerMappingActionDrawer.tsx`, `partner_title_matches` |
| Deals | `DealOperationsConsole.tsx`, `deal_memos`, `admin_deal_*` RPCs |
| Revenue | `RevenueStatementImport.tsx`, `CreatorRevenueSummary`, `revenue_lines` |
| Audit timeline | `admin_title_history` RPC, `title_removal_events`, `commercial_request_events` |
| Assets | `title_assets` + `recent_uploads` (already loaded by drawer) |
| Distribution | `DistributionOffersConsole.tsx`, `distribution_program_offers` |

**No backend blockers for phase 1.** Every tab below binds to data that already exists behind current RLS.

---

## Phase 1 — Shell + reuse (this batch)

Deliverables:

1. **`src/components/admin/office/TitleWorkspace.tsx`** — new tabbed workspace shell.
   - Layout: sticky header (poster/banner/title/status pills/action bar) + left tab rail + main scroll region + optional right context panel. Desktop-first, collapses to single column under `md`.
   - Opens in a full-height `Sheet` (side="right", `sm:max-w-6xl`) from Movie Desk. Retains existing `TitleInspectionDrawer` fallback flag for one release.
2. **Header action bar** wires to existing handlers only:
   - Approve / Send Back / Mark Ready → existing `content_titles` update path from `TitleInspectionDrawer`.
   - Pass QC / Pass Legal → existing RPCs used by `QCLegalValidationSurface`.
   - Publish to Marketplace / Create Deal / Generate Agreement / Generate Invoice / Trigger Delivery → open respective existing consoles inline (no new endpoints).
3. **Tabs — each is a thin wrapper that mounts an existing component scoped to the current `titleId`:**

```text
Overview        → summary cards built from content_titles + title_assets + review_checklist counts
Metadata        → read-only field grid from content_titles (edit deferred to phase 2)
Artwork & Media → existing artwork/preview/documents sections from TitleInspectionDrawer, extracted
Technical QC    → <QCLegalValidationSurface mode="qc" titleId=... />
Legal           → <QCLegalValidationSurface mode="legal" titleId=... />
Rights          → title_rights_availability grid (read + inline status pill)
Buyer Mapping   → <BuyerMappingActionDrawer titleId=... variant="embed" />
Marketplace     → <TitleCommercialOpsConsole titleId=... variant="embed" />
Deals           → <DealOperationsConsole titleId=... variant="embed" />
Documents       → documents section (reuses drawer logic)
Revenue         → revenue_lines filtered by title_id (reuses CreatorRevenueSummary query)
Audit Timeline  → admin_title_history RPC + merged events, chronological
```

4. **Movie Desk integration** — `MediaOffice.tsx` row click already opens the drawer; swap the target component to `TitleWorkspace`. Keep list, filters, and counters untouched.
5. **UX polish**: keyboard shortcut `⌘/Ctrl + K` for search inside workspace, `[ ]` to switch tabs, `Esc` to close, sticky action bar, status badges from existing `OFFICE` labels, resizable split for Deals/Buyer Mapping.
6. **Guardrails**: every tab renders `null` + explanation banner when the underlying RLS returns no rows or the role lacks permission — never invented data.

Out of scope for phase 1: metadata editing UI, rights matrix editor, agreement/invoice generation triggers (buttons visible but call existing consoles).

---

## Phase 2 — Fill gaps (follow-up batch, only after phase 1 lands)

- Metadata inline edit (writes through existing `content_titles` update guarded by `title_lock_state`).
- Rights matrix editable grid → `title_rights_availability` upserts.
- Buyer auto-suggest ranking (genre/language/territory) computed client-side from existing `partner_profiles` + `title_commercial_profiles`; no new RPC.
- Bulk actions in Movie Desk list.

Any gap that would require a new RPC, table, or column will be reported as a **backend blocker** and paused per the user's rule — no invented data, no bypass.

---

## Files to add / change (phase 1)

**Add:**
- `src/components/admin/office/TitleWorkspace.tsx` (shell + header + tab router)
- `src/components/admin/office/tabs/OverviewTab.tsx`
- `src/components/admin/office/tabs/MetadataTab.tsx`
- `src/components/admin/office/tabs/MediaTab.tsx` (poster/banner/trailer/gallery/subtitles from `title_assets`)
- `src/components/admin/office/tabs/RightsTab.tsx`
- `src/components/admin/office/tabs/DocumentsTab.tsx`
- `src/components/admin/office/tabs/RevenueTab.tsx`
- `src/components/admin/office/tabs/AuditTab.tsx`
- `src/components/admin/office/WorkspaceHeader.tsx`
- `src/components/admin/office/WorkspaceActionBar.tsx`

**Modify (minimal):**
- `src/pages/admin/MediaOffice.tsx` — swap `TitleInspectionDrawer` → `TitleWorkspace` (behind a `useWorkspaceUi` fallback flag).
- `src/components/admin/QCLegalValidationSurface.tsx`, `BuyerMappingActionDrawer.tsx`, `TitleCommercialOpsConsole.tsx`, `DealOperationsConsole.tsx` — accept optional `variant="embed"` prop to hide their own outer chrome when embedded. No logic changes.

**Do NOT touch:** RLS, RPCs, `types.ts`, `client.ts`, routes, permissions, `productionFilters.ts`, quarantine tags.

---

## Verification

- `tsgo --noEmit`
- Vitest suites: `admin-*`, `title-*`, `nine-workstream-repairs`, `batch2b-production-filter-wiring`
- Playwright: open `/admin/office?room=movies`, click a real title, confirm each tab mounts, action bar buttons resolve to existing modals, no console errors.

---

## Rollback

Single flag flip in `MediaOffice.tsx` returns to `TitleInspectionDrawer`. All new files are additive.
