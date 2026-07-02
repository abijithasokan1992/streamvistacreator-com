# Dashboard IA + Guided Tools Refactor

This is a large, multi-dashboard restructure. To keep it safe (no business-logic rewrites, no auth/payments/storage backend churn), I'll ship it in **4 phased patches**, one dashboard per patch, plus a small shared primitives patch first. Each phase is independently shippable — you can pause or redirect between phases.

## Phase 0 — Shared primitives (small)

Add a thin, reusable tools-layer kit used by every dashboard. Pure presentation, no business logic.

New files under `src/components/shared/tools/`:
- `QuickActionCard.tsx` — icon + title + 1-line desc + CTA
- `QuickActionGrid.tsx` — responsive 2/3/4 col grid
- `GuidedWizard.tsx` — multi-step shell (steps, progress, back/next/finish) — wraps existing form inputs, owns no state beyond step index
- `StatusSummaryCard.tsx` — label/value + status pill + optional progress bar
- `HelpDrawer.tsx` — right-side drawer for contextual help content
- `PlanVisibilityCard.tsx` — plan name + tier pill + quota line + upgrade/request CTA (role-agnostic, takes props)

These are pure UI; existing role logic feeds them.

## Phase 1 — Creator dashboard

Final IA (left nav, in this order):
```text
Home · Titles · Library · Billing · Help
```

Changes:
- `CreatorSidebar.tsx` — collapse `submissions`, `updates`, `profile` out of the top nav. Profile moves under Home as a card link; Review Queue + Inbox surface inside Home as widgets (no route loss; old `SectionId`s still resolve).
- Creator Home gets a **Creator Tools** strip (QuickActionGrid):
  - New Title Wizard (deep-link → Titles → new)
  - Submission Readiness Checker (opens HelpDrawer with checklist driven by existing readiness logic)
  - Metadata / Asset Upload Guide (HelpDrawer)
  - Commercial Path Summary (StatusSummaryCard)
  - Upgrade / Plan Help (links to Billing)
  - Support Shortcut (links to Help)
- Plan visibility: `PlanVisibilityCard` pinned at top of Home and top of Billing — shows plan name, storage used/total, submission path state, tier pill (Free/Paid/Managed/Founder/Custom).

Touched files (approx): `CreatorSidebar.tsx`, `pages/dashboards/ContentOwner.tsx` (Creator shell), 1 new `CreatorQuickActions.tsx`, 1 new `CreatorPlanStrip.tsx`.

## Phase 2 — Studio dashboard

Final IA:
```text
Home · Ingest · Storage · Library · Billing
```

Changes:
- `pages/dashboards/StudioDash.tsx` — regroup existing sections into the 5 above (Ingest = camera-to-cloud + hard-disk intake; Storage = Oracle/OCI monitor + planner; Library = vault).
- Studio Tools strip (QuickActionGrid) on Home:
  - Ingest Setup Wizard (GuidedWizard wrapping existing `CameraToCloudIngest` config screens)
  - Storage Planner (StatusSummaryCard + helper drawer; uses existing storage figures)
  - Service Request Wizard (wraps existing `StudioRequestService`)
  - Upload / Ingest Diagnostics Helper (HelpDrawer)
  - Plan / Storage Request shortcut (opens existing `StudioRequestPlanChange`)
- Plan visibility: `PlanVisibilityCard` on Home + Billing (plan, storage used/total, request-plan CTA).

## Phase 3 — Buyer / Licensing dashboard

Final IA:
```text
Overview · My Requests · New Request · Billing
```
(Billing tab hidden if no buyer billing entitlement.)

Changes:
- `pages/dashboards/Buyer.tsx` — restructure tabs to the 4 above.
- Buyer Tools strip on Overview:
  - New Request Wizard (GuidedWizard wrapping current request form)
  - Rights Scope Helper (HelpDrawer)
  - Screener Request Guide (HelpDrawer + CTA)
  - Commercial Note Builder (small templated note generator, pure FE)
  - Catalog / Acquisition Request shortcut
- Plan visibility: `PlanVisibilityCard` on Overview — buyer tier, screener state, active requests count.

## Phase 4 — Admin dashboard

Final IA — **7 slim top-level departments** in main sidebar:
```text
Dashboard · Operations · Accounts · Commerce
Storage & Delivery · Comms · System
```

Section mapping (secondary nav inside each page, not in main sidebar):
- **Operations** → Approvals, Pipeline, Catalog Ops (TitleReviewPanel, OnboardingApprovals, ContentReviewWorkflow, DealOperationsConsole, ScreeningOpsConsole, TitleCommercialOpsConsole, TitleEditRequestsInbox, CommercialControlTower)
- **Accounts** → Users, Organizations, Roles & Access (UsersAndCredentials, AdminTeamManager, RolesManager, UserEntitlementDrillIn)
- **Commerce** → Plans & Pricing, Billing, Entitlements, Commercial Requests (ProductsAndPlans, StudioVaultPricing, FreeTierConfig, BillingOperations, AdminFinanceConsole, AdminInvoices, ManualInvoiceConsole, EntitlementExplorer, CommissionsTracker, DistributionOffersConsole, PremiumInvitations)
- **Storage & Delivery** → Storage, Uploads, Vault/Delivery (OracleOciStorageCard, OracleStorageMonitor, StorageGrantPanel, GlobalAssetManager, AdminStudioVaultPurchases)
- **Comms** → Notifications, Email, Support (UniversalBroadcast, EmailLogMonitor, ResendCredentials, ContactInbox, SupportInbox, PaymentSecurityEvents, RazorpayAuditLog, RazorpayOpsBanner)
- **System** → Homepage CMS, Settings, Audit, **Founder Vault** (MarketingCMS, HeroModeControl/HeroLivePreview/HeroReelPreview, PartnerLogos, BrandingSettings, CompanyProfileSettings, AdminCredentials, RazorpayCredentials, RazorpayConnectivityStatus, AiMcpControlCenter, PaymentTrace, PlatformOverview, PlatformOwnerConsole, ChiefBriefing, KammattamMeter, FounderVault)

Changes:
- `pages/Admin.tsx` — main sidebar reduced to the 7 departments. Each department page renders a secondary tab bar with its sub-sections. No component logic rewritten — components are reparented only.
- New `AdminCommandBar.tsx` — top command/search bar (Cmd+K) that fuzzy-searches across all admin sub-section names and jumps to `?dept=…&section=…`.
- RBAC, scanner, and admin business components are untouched (only their parent location changes).

## What stays untouched

- Auth, payments, Razorpay/Stripe wiring, storage backend, RLS, edge functions
- Public homepage, pricing page, legal pages, blog
- Entitlement evaluation logic
- The Creator Title Editor (recently refactored)
- All existing routes/URLs continue to resolve via legacy aliases

## Technical notes

- All new components use existing shadcn primitives + lucide icons + design tokens — no new deps.
- Wizards wrap **existing** forms; they don't reimplement submit logic.
- Plan/quota figures are read from the same hooks each dashboard already uses.
- Admin command bar is a pure FE index over the new department/section map; no new backend.

## Suggested execution order

1. Phase 0 (shared primitives) — required by all later phases
2. Phase 1 (Creator)
3. Phase 2 (Studio)
4. Phase 3 (Buyer)
5. Phase 4 (Admin) — largest; ship last

Reply with **"go"** to execute all phases in order, or name specific phases to start with (e.g. "Phase 0 + 1 only").
