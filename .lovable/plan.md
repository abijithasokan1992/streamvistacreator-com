
# StreamVista Public + Dashboard Audit — Read-Only Findings & Resolution Plan

Scope: `main` at commit currently synced. Nothing to edit in this plan; every item is documented so you can approve fixes in a later batch. Creator RC1 frozen behaviour is preserved throughout — none of the proposed changes touch `TitleEditor.tsx`, Creator submission RPCs, or Distribution read-only state.

---

## 1. Homepage — duplicate wording, blocks, badges, claims

### 1.1 Duplicate / stacked "trust" surfaces (P1)
`src/pages/Index.tsx` renders three overlapping trust surfaces back-to-back:
1. `<TrustedDistributionPartners />` — 5 partner chips.
2. A wrapper `<section>` immediately below with `<TrustBadges compact />` (HTTPS / Payment / Cloud X / IP compliance).
3. `<Footer />` re-renders the same trust chips (Lock / Cloud X / ShieldCheck) inside the brand column when `isHome` (`src/components/streamvista/Footer.tsx` lines ~90-104).

Resolution: keep partners band only; delete the standalone `TrustBadges` section in `Index.tsx`; drop the `isHome` trust chip block from `Footer.tsx` (trust language already reachable via /trust-and-rights and legal footer column).

### 1.2 Questionable partner claims (P0)
`src/components/streamvista/TrustedDistributionPartners.tsx` hard-codes:
```
Sun Nxt, Amritha, Amazon Prime, JioCinema, ZEE5
```
under the eyebrow "Trusted Distribution Partners". Even without logos this is a written brand-affiliation claim; only "Amritha" (Amrita TV) is a verified StreamVista relationship. Amazon Prime, JioCinema, ZEE5, Sun NXT have no signed partnership on record in `partner_profiles`.

Resolution options (pick one):
- Replace hard-coded list with `fetchPartnerProfiles()` filtered to `verified = true` (same source as `/partners`).
- Or restate the eyebrow as "Distribution surfaces we prepare deliveries for" with no logos and no brand names, only categories (OTT, FAST, Broadcast, Satellite, Airline, Educational).
- Remove the section entirely and rely on `/partners`.

### 1.3 Duplicate brand mark (P2)
"STREAMVISTA · Cloud X" appears in: Navbar wordmark, Hero eyebrow (`Cloud X`), TrustBadges chip ("StreamVista Cloud X"), Footer wordmark, Footer trust chip. Recommend keeping Navbar + Footer only.

### 1.4 Repetitive homepage sections & vertical rhythm (P1)
Stack today: `Hero (pt-40 pb-32)` → partners (py-5) → trust badges (py-6) → `Workflow (py-24)` → `PlatformOverview (py-24)` → `SupportedContent` → `RightsDistribution (py-24)` → `AIContentLicensingSection (py-24)` → `FinalCta (py-28)` → `Footer (mt-24 py-12)`.
- `Workflow` and `PlatformOverview` cover overlapping "here is how it works" content.
- `SupportedContent` and `RightsDistribution` overlap on catalogue/format messaging.
- Total vertical between Hero end and FinalCTA is ≥ 6× py-24.

Resolution: merge `Workflow` + `PlatformOverview` into one "How StreamVista Works" section; merge `SupportedContent` into `RightsDistribution` as a single "Rights, formats & buyers" section; standardize non-hero sections to `py-16 sm:py-20`.

### 1.5 Hero wording (P2)
`src/components/streamvista/Hero.tsx`:
- Two body paragraphs repeat "OTT platforms, broadcasters, satellite television, FAST channels, distributors" — the exact string is also in `Seo.description` and the trailing mono-tech line "Film Sales · OTT & FAST Licensing · Satellite & Digital Distribution Workflow".
- The trailing eyebrow (line 82) duplicates the top eyebrow message.

Resolution: keep top eyebrow + one 2-sentence paragraph + disclaimer; delete the trailing mono-tech eyebrow.

### 1.6 CTA labels & destinations (verified)
| Location | Label | Destination | Status |
|---|---|---|---|
| Navbar (signed-out) | "Get Started" | `/auth?intent=signup` | ✅ |
| Navbar (signed-in) | "Dashboard" | `dashboardForRole(role)` | ✅ but see §3.1 |
| Hero primary (signed-out) | "Get Started · I'm a Creator" | `/auth?intent=signup` | ✅ |
| Hero secondary | "I'm a Buyer · Request Access" | `/contact?topic=buyer-access` | ✅ |
| FinalCTA | "Create Your Workspace" | `/auth?intent=signup` | ✅ |
| FinalCTA (signed-in) | "Open Your Dashboard" | `dashboardForRole(role)` | ✅ |

No broken CTA destinations found; only the Hero eyebrow label "Get Started · I'm a Creator" implicitly narrows the audience even though the flow supports all four pillars (P2 copy nit).

---

## 2. Navbar / Footer / public routes

### 2.1 Navbar (`src/components/streamvista/Navbar.tsx`)
Links: `/`, `/#platform`, `/pricing`, `/creator-preview`, `/partners`, `/about`, `/contact`.
- `/#platform` resolves to `<section id="platform">` in `PlatformOverview.tsx` ✅.
- Item labelled "Solutions" is a single anchor and hides the 8 dedicated /sell-your-film, /film-distribution, /ott-content-licensing, /content-owners, /buyers, /film-rights, /regional-indian-cinema, /global-film-sales pages — those routes exist but are only reachable via SEO/direct URLs. P1 information-architecture gap: add a Solutions dropdown or a `/solutions` index page.

### 2.2 Footer (`src/components/streamvista/Footer.tsx`)
- `PRODUCT_LINKS` uses `/#platform` (same as Navbar) — fine but again hides the 8 landing pages.
- `TRUST_LINKS` points to `/dmca#submit-notice` and `/dmca#grievance`. Route `/dmca` is aliased to `<IPCopyright />` in `App.tsx`. Need to verify those anchor ids exist inside `IPCopyright.tsx` (spot-check shows only `#submit-notice` present; `#grievance` missing → P2 dead anchor).
- Footer link "Agent integrations" → `/connect` is jargon; rename to "Integrations & AI agents" (P2).
- Legal footer duplicates `/ip-copyright` and `/dmca` (both render `IPCopyright`) — pick one.

### 2.3 Public routes inventory (`src/App.tsx`)
Verified renderable, non-duplicate: `/`, `/auth`, `/auth/callback`, `/.lovable/oauth/consent`, `/reset-password`, `/checkout/return`, `/checkout/storage`, `/billing/status/:topupId`, `/s/:token`, `/review/:token`, `/screening/:token`, `/terms`, `/privacy`, `/ip-copyright`, `/dmca` (aliased), `/refund`, `/pricing`, `/about`, `/partners`, `/creator-preview`, `/c2c-setup`, `/blog/*`, `/support→/contact`, `/contact`, `/submit-content`, `/unsubscribe`, `/invoice/:id`, `/invoice/manual/:id`, `/college-erp`, `/connect`, `/accessibility`, plus 10 /solutions-style landing pages.

Duplicate/dead routes to review:
- `/dmca` vs `/ip-copyright` — same component (P2 pick one, redirect the other).
- `/submit-content` — no navbar/footer entry, only reachable from external links (P2 confirm still intended).
- `/college-erp` — orphaned marketing page, no inbound link (P2).
- `/connectors` → redirects to `/connect` (fine).

---

## 3. Role routing after login

### 3.1 Loop risk in `dashboardForRole` fallbacks (P0)
`src/hooks/useAuth.tsx` returns `/dashboard/localization` for `localization_partner` and `/dashboard/distribution` for `distributor`. `src/App.tsx` wires both of those paths to `<CanonicalDashboardRedirect />`, which itself calls `dashboardForRole(role)` and `<Navigate replace>` to the same path → **infinite redirect** for any user with those roles. Also `/studio` → `CanonicalDashboardRedirect` will loop if role is `studio` (redirects to `/dashboard/studio` which is fine, but for a non-studio user it redirects away — acceptable). The localization/distributor case is the real bug.

Resolution: either add real dashboard pages for those two roles, or change `dashboardForRole` to fall those roles back to `/dashboard/content` (creator surface with distributor tools) with a system message.

### 3.2 Missing `/dashboard` canonical redirect protection (P2)
`/dashboard` → `CanonicalDashboardRedirect` works, but there is no `/creator` alias while `/studio` and `/buyer` (via `/dashboard/buyer`) exist. Add `/creator` → `/dashboard/content` for consistency, or remove `/studio` for symmetry.

### 3.3 Admin subdomain fan-out (P1)
`AdminRoutes` maps 18 paths (`/admin/users`, `/admin/approvals`, `/admin/catalog`, `/admin/billing`, `/admin/storage`, `/admin/comms`, `/admin/settings`, `/admin/audit`, `/admin/homepage`, `/admin/qc`, `/admin/legal`, `/admin/content`, `/admin/support`, `/admin/reports`, `/admin/ecosystem`) all to the same `<Admin />` component. Verify each corresponds to a section switch inside `Admin.tsx`; any without a handler is dead (renders default tab silently). File to audit next: `src/pages/Admin.tsx` — enumerate `?section=` handlers and delete unused route entries.

### 3.4 Buyer / Studio dashboard nav
- `Buyer.tsx` handles legacy `marketplace→find` and `deliveries→commercial` redirects ✅.
- `StudioDash.tsx` (1285 lines) uses `StudioShell` sections — spot audit needed for orphan sections; not blocking.

---

## 4. Dashboard quick actions & navigation

### 4.1 CreatorQuickActions (`src/components/creator/CreatorQuickActions.tsx`)
All six cards route via `onNavigate(section)` (in-shell) or the Pricing page — no dead links found. RC1-safe.

### 4.2 StudioQuickActions (`src/components/studio/StudioQuickActions.tsx`)
Five cards; `Service Request` and `Plan Request` fall back to `onOpenBilling` when the specific handler is undefined. Verify in `StudioDash.tsx` that both callbacks are wired; a missing prop silently opens Billing. Not user-facing broken but audit for correctness (P2).

### 4.3 Admin QuickActions (`src/components/admin/QuickActions.tsx`)
Depends on Admin.tsx section switch — audit alongside §3.3.

### 4.4 Buyer dashboard nav
`BuyerNav` sections mapped 1:1 to renderers in `Buyer.tsx` — no dead entries.

---

## 5. Homepage → auth / onboarding / contact flow (verified paths)

| From | Target | Behaviour |
|---|---|---|
| Hero primary (signed-out) | `/auth?intent=signup` | Auth page shows signup; on success → `AuthCallback` → `/my-workspace?first=1&next=…` → `Onboarding` when incomplete → dashboard. ✅ |
| Hero buyer CTA | `/contact?topic=buyer-access` | Contact form pre-selects buyer intent. ✅ |
| FinalCTA (signed-in) | `dashboardForRole(role)` | Same infinite-loop risk noted in §3.1 for distributor/localization. |
| Navbar signed-in | `dashboardForRole(role)` | Same as above. |
| `/my-workspace` | now wrapped in `OnboardingGate` (previous batch) | ✅ closed. |

No stray direct-to-dashboard links skipping OnboardingGate found in public code.

---

## 6. Cookie banner (`src/components/CookieConsent.tsx`)

Findings:
- Suppression list is comprehensive (admin, dashboard, studio, review, screening, my-workspace, checkout, onboarding, .lovable). ✅
- Layout is bottom-right desktop / bottom-full mobile, `max-w-md`, glass card. Overlaps the AssistantLauncher FAB (also bottom-right) on desktop viewports — P1 z-index/positioning collision to verify visually.
- Wording claims: "With your consent we also record anonymous usage for reliability." No analytics library is currently wired to `readCookieConsent()` (checked via ripgrep). This is a **material claim** with no matching implementation — either remove the sentence or add the consent-gated telemetry hook (P1 legal/UX honesty).
- The `X` (dismiss) icon writes `essential-only` — under GDPR/DPDP the close affordance should be a neutral dismiss (do nothing), and "Reject" should be an explicit button. Rename the second button to "Reject non-essential" and have `X` set nothing (or default to reject with the same value but change label) (P2).
- No "Manage preferences" surface — acceptable for a one-category banner, but privacy policy link is present. ✅

---

## Consolidated priority matrix

| # | Priority | File(s) | Fix |
|---|---|---|---|
| 1.2 | **P0** | `TrustedDistributionPartners.tsx` | Replace / remove unverified brand names. |
| 3.1 | **P0** | `hooks/useAuth.tsx` + `App.tsx` | Remove distributor/localization redirect loop. |
| 1.1 | P1 | `Index.tsx`, `Footer.tsx` | Remove duplicate TrustBadges + footer isHome trust chips. |
| 1.4 | P1 | `Workflow.tsx`, `PlatformOverview.tsx`, `SupportedContent.tsx`, `RightsDistribution.tsx`, `Index.tsx` | Merge overlapping sections; normalize py-16/20. |
| 2.1 | P1 | `Navbar.tsx` | Solutions dropdown or `/solutions` index. |
| 3.3 | P1 | `App.tsx`, `Admin.tsx` | Prune admin routes not handled by section switch. |
| 6a | P1 | `CookieConsent.tsx` | Remove/implement "anonymous usage" claim. |
| 6b | P1 | `CookieConsent.tsx` + `AssistantLauncher` | Fix bottom-right stacking collision. |
| 1.3 | P2 | Hero/TrustBadges/Footer | Trim brand mark repetition. |
| 1.5 | P2 | `Hero.tsx` | Delete trailing eyebrow + tighten paragraphs. |
| 1.6 | P2 | `Hero.tsx` | Broaden signup CTA copy beyond "I'm a Creator". |
| 2.2 | P2 | `Footer.tsx`, `IPCopyright.tsx` | Remove `#grievance` link or add anchor; rename "Agent integrations". |
| 2.3 | P2 | `App.tsx` | Consolidate `/dmca` vs `/ip-copyright`; drop `/college-erp` if unused. |
| 3.2 | P2 | `App.tsx` | Add `/creator` alias or drop `/studio` for symmetry. |
| 4.2 | P2 | `StudioDash.tsx` | Verify Studio quick-action callbacks are all wired. |
| 4.3 | P2 | `Admin.tsx` | Enumerate section handlers, delete unused route entries. |
| 6c | P2 | `CookieConsent.tsx` | Explicit "Reject non-essential" button; neutralize X. |

---

## Tests to run after the fix batch (no changes yet)

1. **Vitest focused:** `bunx vitest run src/test/smoke/**` — must stay green (Creator RC1 smoke).
2. **Typecheck:** `tsgo -p tsconfig.json` — 0 errors.
3. **Build:** production build must succeed.
4. **Playwright public flow (headless):**
   - `/` renders in light + dark, no duplicated TrustBadges band, single "Trusted…" band, footer has no trust chips.
   - Navbar links: Solutions, Pricing, Creator Preview, Partners, About, Contact all 200 and correct target.
   - Footer links: every URL 200; verify `#submit-notice` / `#grievance` anchors resolve.
   - Hero CTA → `/auth?intent=signup`; Buyer CTA → `/contact?topic=buyer-access`.
   - Cookie banner appears on `/`, hidden on `/dashboard*`, `/admin*`, `/my-workspace`, `/checkout/*`.
5. **Role redirect matrix (Playwright, seeded users):**
   - creator → `/dashboard/content`
   - studio → `/dashboard/studio`
   - buyer → `/dashboard/buyer`
   - admin → `/admin`
   - distributor / localization_partner → non-looping destination (after §3.1 fix).
6. **Admin quick-action audit:** click each admin sidebar entry; expect either handled section or removed route.
7. **Cookie banner:** accept / essential-only / dismiss; verify cookie `sv_cookie_consent` written and banner does not re-appear.
8. **Contrast re-check (`/contact`):** the previously-flagged 4 findings (text-accent, .opacity-60) — still open; include in any P1 fix batch that touches Contact.

---

## Not changed / preserved

- `TitleEditor.tsx`, `submit_title_to_admin` RPC, `Distribution.tsx` read-only lock, `checkoutHostGuard`, Razorpay flow, Master Admin identity — untouched by any proposed fix.
- Paddle stays disabled.
- No Supabase migrations, no deploys, no publish.

Approve this plan and I'll implement in strict P0 → P1 → P2 order, one batch per priority tier, with tests between tiers.
