# StreamVista Read-Only Audit — Resolution Plan

Scope: latest `main`. No code, DB, or deploy changes proposed here — only a file-level remediation plan. Creator RC1 (frozen per `docs/milestones/CREATOR_RC1_FROZEN.md`) is preserved: nothing in `src/components/creator/**`, `src/pages/dashboards/ContentOwner.tsx`, or the title editor is touched.

---

## 1. Findings

### A. Homepage (`src/pages/Index.tsx`)

Order rendered: Hero → TrustedDistributionPartners → TrustBadges band → Workflow → PlatformOverview → SupportedContent → RightsDistribution → AIContentLicensingSection → FinalCta → Footer.

- **[P1] Duplicate trust surfaces.** `TrustBadges` (Lock / Secure Payment / Cloud X / IP Compliance) render directly under `TrustedDistributionPartners`, then the Footer re-renders the same three chips (Lock / Cloud X / IP Compliance) via its `isHome` block (`Footer.tsx:72-84`). The "Cloud X" and "IP & Copyright Compliance" chips appear twice on `/`.
- **[P1] Duplicate primary CTA copy.** Hero primary CTA = "Open Your Dashboard / Get Started · I'm a Creator"; FinalCta reuses the identical "Open Your Dashboard" label and same gradient/style — no differentiation between top and bottom of page.
- **[P1] Section heading pattern repetition.** Every section (`Workflow`, `PlatformOverview`, `SupportedContent`, `RightsDistribution`, `AIContentLicensingSection`) uses the same eyebrow pattern (`w-8 h-px bg-accent` + mono-tech uppercase). Fine as a system, but the "License across every channel" and "Every format, one platform" headings sit back-to-back with near-identical structure — reads as filler.
- **[P2] Wordmark repetition.** "STREAMVISTA · CLOUD X" appears in Navbar, Hero eyebrow, Footer brand block, Footer trust chip, and Footer Wordmark — 5 renders on `/`.
- **[P2] Gap between `TrustedDistributionPartners` and standalone `TrustBadges` band** — two thin bordered strips stacked (`Index.tsx:60-65`), creating visual clutter before Workflow starts.

### B. Navbar / Footer wiring

`src/components/streamvista/Navbar.tsx` links:
- `/`, `/#platform` (✓ id exists on `PlatformOverview`), `/pricing` (✓), `/creator-preview` (✓), `/partners` (✓), `/about` (✓), `/contact` (✓). All resolve.

`src/components/streamvista/Footer.tsx` links:
- Product: `/#platform`, `/pricing`, `/creator-preview`, `/partners`, `/connect` (all ✓).
- Company/Legal: `/about`, `/contact`, `/terms`, `/privacy`, `/ip-copyright`, `/accessibility` (all ✓).
- **[P1] Trust & Safety dead anchors.** `/dmca#submit-notice` and `/dmca#grievance` — `/dmca` route exists (aliases to `IPCopyright`) but `IPCopyright.tsx` does not render `id="submit-notice"` or `id="grievance"` anchors, so both links land at the top and look broken.
- **[P2] Navbar missing Solutions surface.** Public landing routes `/sell-your-film`, `/film-distribution`, `/ott-content-licensing`, `/how-it-works`, `/trust-and-rights`, `/global-film-sales`, `/regional-indian-cinema`, `/film-rights`, `/buyers`, `/content-owners`, `/guides/film-licensing-costs-and-agreements` are registered in `App.tsx` but not reachable from the navbar or footer — only via SEO/direct links.

### C. Login → role dashboard routing

- `Index.tsx:19-20`: signed-in users are redirected off `/` via `<Navigate to={dashboardForRole(role)} replace />`.
- `dashboardForRole` (`src/hooks/useAuth.tsx:252-270`) → registered targets are enumerated in `REGISTERED_DASHBOARD_ROUTES` and asserted by `src/test/smoke/reviewer-routing.test.tsx`.
- **[P0] Redirect loop for dormant Phase-2 roles.** `dashboardForRole("localization_partner")` → `/dashboard/localization`, and `dashboardForRole("distributor")` → `/dashboard/distribution`. `App.tsx:175-176` maps both of those paths to `<CanonicalDashboardRedirect />`, which in turn calls `dashboardForRole(role)` and navigates back to the same URL → infinite `<Navigate replace>` loop for any user still holding one of these legacy roles. `REGISTERED_DASHBOARD_ROUTES` lists both, so the existing smoke test passes even though the runtime is a loop.
- **[P1] Admin subdomain host reuses public dashboard redirects incorrectly.** `AdminRoutes` (`App.tsx:120-152`) has no `/dashboard/*` entries; any signed-in non-admin who lands on `admin.streamvista.in/dashboard/content` hits the `<WrongPortal expected="public" />` catch-all, which is correct — but `AdminRoot` unconditionally sends any signed-in user to `/admin` regardless of role, so a signed-in creator on `admin.streamvista.in/` sees the admin console shell before `RoleGate` decides. Confirm `Admin.tsx` internally gates by role; if not, add `RoleGate` around `<Admin />` routes.

### D. Duplicate / dead routes and actions

- **[P1] Duplicate route table.** Every `/admin/*` route (23 entries) is declared twice — once in `AdminRoutes` and again in `PublicRoutes` (`App.tsx:120-152` vs `186-207`). Two sources of truth; any future admin route must be added twice or admin subdomain drifts.
- **[P2] Dead / orphan routes.** `/college-erp` (App.tsx:232, `CollegeERP.tsx`) is not linked from any nav, footer, or dashboard; ships to production as an orphan.
- **[P2] Redirect-only routes that no longer have inbound links:** `/uploads`, `/producer`, `/vault`, `/studio`, `/client`, `/projects`, `/archive`, `/team` (App.tsx:178-185). Kept for legacy magic-link backwards-compat — safe to leave but should be documented.
- **[P2] Dashboard "New Title" & Quick Actions duplication** was already flagged in `.lovable/plan.md` (previous audit) — not re-litigated here.

### E. Cookie banner (`src/components/CookieConsent.tsx`)

- **[P1] Z-index / layout collision.** Banner is `z-[60]`, positioned `bottom-3` right. `AssistantLauncher` and `RouteAgentDock` also mount at `App.tsx:274-276` at the bottom-right; on mobile (`inset-x-3`) the banner spans full width and overlaps the assistant FAB. `SUPPRESSED_PREFIXES` covers authoring routes but not `/`, so first-time visitors on the homepage see the banner cover the assistant.
- **[P2] `/studio` prefix suppression is too broad.** It also suppresses the banner on the `/studio` legacy redirect and (more importantly) on the public `/studio/ingest/engine` route which is behind auth anyway — cosmetically fine, but the prefix rule should be `/studio/` (with trailing slash) or an exact list to avoid future collisions if a marketing `/studios` page is added.
- **[P2] No "Manage preferences" affordance.** Only "Accept all" and "Essential only" are offered; a future GDPR audit will flag the missing granular toggle. Not urgent.

---

## 2. Resolution plan (file-level)

### P0 — Fix before next release

| # | File | Change |
|---|------|--------|
| P0-1 | `src/hooks/useAuth.tsx` | In `toDashboardRole`, map `distributor` and `localization_partner` → `buyer` (or `content_owner`) so `dashboardForRole` no longer returns `/dashboard/distribution` or `/dashboard/localization`. |
| P0-2 | `src/App.tsx` | Remove the `/dashboard/localization` and `/dashboard/distribution` routes (lines 175-176), or point them at a real page instead of `CanonicalDashboardRedirect`. |
| P0-3 | `src/hooks/useAuth.tsx` | Drop `/dashboard/localization` and `/dashboard/distribution` from `REGISTERED_DASHBOARD_ROUTES` once P0-1 lands. |

### P1 — High-value cleanup

| # | File | Change |
|---|------|--------|
| P1-1 | `src/pages/Index.tsx` | Remove the standalone `TrustBadges` band (lines 61-65) — trust chips already render in Footer for `/`. Collapses two stacked strips into one. |
| P1-2 | `src/components/streamvista/Footer.tsx` | De-duplicate: keep the Footer trust chip block on `/`, or (preferred) remove `isHome` chips and keep only the standalone `TrustBadges`. Pick one home for the badges. |
| P1-3 | `src/components/streamvista/FinalCta.tsx` | Change signed-in label from "Open Your Dashboard" to a differentiated bottom-of-page CTA (e.g. "Continue to your workspace"), and swap the outline style so it does not visually mirror the Hero primary CTA. |
| P1-4 | `src/pages/IPCopyright.tsx` | Add `id="submit-notice"` and `id="grievance"` section anchors so the footer Trust & Safety links land correctly. |
| P1-5 | `src/components/streamvista/Navbar.tsx` | Add a "Solutions" dropdown (Sheet on mobile) linking `/sell-your-film`, `/film-distribution`, `/ott-content-licensing`, `/how-it-works`, `/trust-and-rights`. Keep the current top-level `/#platform` for anchor jump. |
| P1-6 | `src/App.tsx` | Extract the admin route list into a single `ADMIN_ROUTES` array consumed by both `AdminRoutes` and `PublicRoutes` to remove the 23-route duplication. Behaviour-preserving. |
| P1-7 | `src/components/CookieConsent.tsx` | Raise assistant FAB z-index above `60`, or lower banner to `z-40` and shift banner up (`bottom-20`) on mobile so it does not overlap the assistant launcher; add `/` explicit case handled by shifted position rather than suppression. |

### P2 — Cleanup / polish

| # | File | Change |
|---|------|--------|
| P2-1 | `src/components/streamvista/Hero.tsx` | Drop the eyebrow "StreamVista · Cloud X" line — Navbar already carries the wordmark 30px above. |
| P2-2 | `src/components/streamvista/Footer.tsx` | Consolidate the two brand renders (Wordmark + BrandChipLabel trust chip) into one. |
| P2-3 | `src/pages/Index.tsx` | Consider merging `PlatformOverview` (Who is it for?) and `SupportedContent` (Every format) into a single 2-row section — reduces "wall of similar cards" feel between Workflow and Rights. |
| P2-4 | `src/App.tsx` | Delete `/college-erp` route + `src/pages/CollegeERP.tsx` if the page is confirmed unused (owner sign-off first). |
| P2-5 | `src/components/CookieConsent.tsx` | Tighten `SUPPRESSED_PREFIXES` to exact-match or trailing-slash form. |
| P2-6 | `src/App.tsx` | Add a comment block above the legacy redirect group (`/uploads`, `/producer`, …) documenting why they remain. |

---

## 3. Tests

New / updated (all under `src/test/smoke/`):

1. **`dashboard-routing-no-loop.test.tsx`** — for every `AppRole` (including `distributor`, `localization_partner`), assert `dashboardForRole(role)` returns a path whose route element in `App.tsx` is **not** `CanonicalDashboardRedirect`. Guards against re-introducing P0-1.
2. **`homepage-no-duplicate-trust.test.tsx`** — render `<Index />` inside `MemoryRouter`, assert the string "IP & Copyright Compliance" appears at most once in the DOM and "Cloud X" trust chip renders at most once.
3. **`footer-anchor-links.test.tsx`** — render `<IPCopyright />` and assert `document.getElementById("submit-notice")` and `document.getElementById("grievance")` exist (locks P1-4).
4. **`admin-routes-single-source.test.ts`** — parse `App.tsx` via AST or regex; assert the extracted `ADMIN_ROUTES` array is referenced by both `AdminRoutes` and `PublicRoutes` (locks P1-6).
5. **`cookie-banner-overlap.test.tsx`** — mount `<CookieConsent />` + `<AssistantLauncher />` on `/`, assert computed `zIndex` of the assistant FAB ≥ the banner's, or that their bounding boxes do not overlap on a 375-wide viewport.
6. Extend existing `reviewer-routing.test.tsx` to also assert none of the returned targets are wired to `CanonicalDashboardRedirect` (belt-and-braces with #1).

---

## 4. Sequencing

1. Land P0-1 → P0-3 as one commit + tests #1 and updated reviewer-routing.
2. P1 batch in a second commit (homepage + navbar + footer + cookie z-index) + tests #2, #3, #5.
3. P1-6 admin route dedupe as its own commit + test #4 (touches routing structure, deserves isolation).
4. P2 polish batch, gated on product confirmation for `CollegeERP` deletion.

Creator RC1 surfaces (`ContentOwner.tsx`, `src/components/creator/**`, title editor, distribution read-only) are untouched throughout.
