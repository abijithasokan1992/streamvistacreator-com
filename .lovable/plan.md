# Creator Portal V2 — Filmhub-Inspired, Phased Rollout

Build the new Filmhub-style Creator Portal alongside the existing dashboard, verify feature parity end-to-end, then flip it to default and remove the legacy shell. Single backend throughout — no duplicate tables, RPCs, edge functions, or workflows. Studio, Buyer, Admin, Mission Control, and Platform Services untouched.

## Phase 1 — Build (parallel, non-default)

New Portal mounted at `/creator/*` behind the existing `OnboardingGate` + `RoleGate allow={["content_owner","creator","studio"]}`. Legacy `/dashboard/content` remains the default landing so nothing breaks while V2 is under verification.

### Shell
- `src/components/creator/shell/CreatorShell.tsx` — shadcn `SidebarProvider` (`collapsible="icon"`) + top bar + `<Outlet />`.
- `CreatorSidebarNav.tsx`, `CreatorTopBar.tsx` (breadcrumb, global search, notification bell, profile menu), `EmptyState.tsx`.
- Light-mode default, hairline borders, uppercase micro-labels, StreamVista accent on primary CTAs / active nav / "live" chips. Tokens only — no hardcoded colors.

```text
┌──────────┬──────────────────────────────────────┐
│ SV logo  │  Breadcrumb · search · profile menu  │
│          ├──────────────────────────────────────┤
│ Catalog  │                                      │
│ Delivery │            Module content            │
│ Distrib. │                                      │
│ Market   │                                      │
│ Rights   │                                      │
│ Revenue  │                                      │
│ Insights │                                      │
│ Team     │                                      │
└──────────┴──────────────────────────────────────┘
```

### Modules (thin composers over existing components — zero backend duplication)

| # | Route | Reuses |
|---|-------|--------|
| 1 | `/creator/catalog` | `content_titles` (owner-scoped), `TitleEditor` for add/edit, `title_lock_state` for lock chips |
| 2 | `/creator/deliveries/:titleId?` | `title_assets`, `deliverables`, `AssetUploader`, `title_media_versions` |
| 3 | `/creator/distribution` | `distribution_program_offers`, `CreatorDistributionOffers`, `distribution_deliveries` |
| 4 | `/creator/marketplace` | `ai_licensing_matches`, `ai_buyer_requirements`, `title_ai_licensing` |
| 5 | `/creator/deals` | `deal_memos`, `title_rights_availability`, `screening_invites`, `offer_rounds` |
| 6 | `/creator/revenue` | `CreatorRevenueSummary`, `revenue_lines`, `partner_statements`, `invoices`, `CreatorInvoices` |
| 7 | `/creator/insights` | `intelligence_snapshots` + client aggregation of `revenue_lines` / `deal_memos` |
| 8 | `/creator/settings` | `workspace_members`, `api_keys`, `BillingSnapshot`, `StorageLive`, `MyCreatorProfile` |

Global: notification bell reads `notifications` + `onboarding_notifications` via existing hooks.

### Routing (Phase 1)
- `App.tsx`: add nested `<Route path="/creator" element={<CreatorShell />}>` with 8 lazy children.
- Legacy `/dashboard/content` **remains default** — add a discoverable "Try new Creator Portal" link in the legacy header pointing to `/creator/catalog` so real users can drive verification.
- No changes to `CanonicalDashboardRedirect` yet.

### Backend contract
- No new tables. No new RPCs. No RLS changes. No edge function changes.
- All writes go through the same existing RPCs the legacy dashboard uses (`creator_resubmit_title`, `creator_request_title_edit`, `admin_set_title_status` where applicable, `submit_title_to_admin`, storage upload session RPCs, etc.).
- All reads scoped by existing `auth.uid()`-based policies.

## Phase 2 — Verify (feature parity + runtime)

Executed against V2 only, using existing test accounts. Each workflow must PASS the same runtime checklist that the P0 verification uses.

Workflows to verify end-to-end on `/creator/*`:
1. **Metadata** — create draft, edit fields, resume after sign-out.
2. **Assets** — upload master + captions + artwork; verify storage bucket + `title_assets` row.
3. **Deliveries** — checklist state transitions.
4. **Distribution** — accept/decline `distribution_program_offers`; territory shown.
5. **Rights** — set exclusivity/window; `title_rights_availability` row updated.
6. **Revenue** — statements list + invoices load; workspace-scoped.
7. **Notifications** — new review note surfaces bell + inbox item.
8. **Draft Resume** — reopen exact draft; no duplicate row.
9. **Publishing** — submit → admin queue → approved → published visible.

Each: UI evidence + DB evidence + audit row + negative test (other non-admin user cannot see it) + Playwright trace. Regression suites: `batch-a-repairs`, `nine-workstream-repairs`, plus new `creator-portal-v2` smoke suite.

Fixes during Phase 2 stay inside V2 pages/components. If a shared component needs a change, apply it in place (both dashboards benefit) — never fork the backend.

## Phase 3 — Cut over

Only after all 9 workflows PASS and zero regressions in Studio / Buyer / Admin:
1. `CanonicalDashboardRedirect` → `/creator/catalog` for creator roles.
2. `/dashboard/content` → `<Navigate to="/creator/catalog" replace />`.
3. Delete legacy `ContentOwnerDashboard` and now-unused legacy-only wrappers. Shared components (`CreatorSidebar`, `CreatorQuickActions`, `CreatorPlanStrip`, etc.) already reused by V2 stay.
4. Update any deep links, emails, and i18n strings pointing at `/dashboard/content`.
5. Final smoke pass on all 9 workflows post-cutover.

## Architecture rules (enforced)

- Single backend, single source of truth, no duplicate tables, no parallel APIs, no duplicate workflows.
- All V2 writes go through existing RPCs; all reads through existing policies.
- Buyer, Admin, Mission Control, Platform Services — untouched in all 3 phases.

## Out of scope

- New AI matching algorithms (surface existing matches only).
- E-sign on deals.
- Notification pipeline / email template changes.
- Studio / Buyer / Admin visual shells.
- Any DB migration or RLS change in any phase.

## Acceptance

- **End of Phase 1:** `/creator/*` renders all 8 modules with real data or empty-state CTAs, legacy dashboard still default, zero backend diffs.
- **End of Phase 2:** all 9 workflows PASS on V2 with evidence archived under `docs/release/creator-portal-v2/`.
- **End of Phase 3:** creators land on `/creator/catalog` by default, legacy dashboard removed, no regressions elsewhere.
