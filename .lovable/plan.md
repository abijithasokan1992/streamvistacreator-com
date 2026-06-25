
## Step 2 — Admin Console Collapse (current 10 tabs + ~40 panels → 8 MVP tabs)

Goal: one tab list, 8 buckets, no duplicate panels, no admin-only feature surfaces that aren't earning. Single file: `src/pages/Admin.tsx` + the `/admin/*` route table.

---

### 1. The 8 MVP buckets and what goes in each

| Tab (URL) | Components kept | Source bucket(s) absorbed |
|---|---|---|
| **Users & Roles** `/admin/users` | `RolesManager`, `UsersAndCredentials`, `AdminTeamManager` | old `users` + `team` |
| **Approvals** `/admin/approvals` | `OnboardingApprovals`, `ContentReviewWorkflow`, `TitleEditRequestsInbox` | from old `content` + `support` |
| **Catalog** `/admin/catalog` | `ProductsAndPlans`, `StudioVaultPricing`, `FreeTierConfig`, `GlobalAssetManager` | from old `settings` + `storage` |
| **Billing** `/admin/billing` | `AdminInvoices`, `ManualInvoiceConsole`, `BillingOperations`, `AdminFinanceConsole`, `RazorpayOpsBanner`, `RazorpayAuditLog`, `PaymentTrace` | old `finance` + `business` (kept slice) |
| **Storage** `/admin/storage` | `OracleStorageMonitor`, `AdminStudioVaultPurchases`, `OracleOciStorageCard` (in `<details>`) | old `storage` |
| **Comms** `/admin/comms` | `SupportInbox`, `ContactInbox`, `EmailLogMonitor`, `UniversalBroadcast` | old `support` |
| **Settings** `/admin/settings` | `BrandingSettings`, `CompanyProfileSettings`, `PartnerLogos`, `ResendCredentials`, `AdminCredentials`, `RazorpayCredentials`, `RazorpayConnectivityStatus`, `DomainHostingPanel` | old `settings` (advanced kept in `<details>`) |
| **Audit** `/admin/audit` | `AdminReportsConsole`, `PaymentSecurityEvents` | old `reports` |

Tab #1 stays the **Overview/Home** above this tab list (it's the landing `PlatformOverview` + QuickNav, not a 9th bucket).

---

### 2. Panels hidden for MVP (kept in repo, not mounted)

Removed from any tab but file kept for Phase 2:
- `PlatformOwnerConsole`
- `AiMcpControlCenter`
- `KammattamMeter`
- `CommissionsTracker`
- `CommercialControlTower`
- `TitleCommercialOpsConsole`
- `ScreeningOpsConsole`
- `DistributionOffersConsole`
- `DealOperationsConsole`
- `PremiumInvitations`
- `MarketingCMS`
- `ChiefBriefing`
- `HeroReelPreview`
- `EntitlementExplorer`, `UserEntitlementDrillIn`, `StorageGrantPanel`, `TitleReviewPanel` (already not on any tab — verify)
- `LegacyOnboardingFunnel`, `MarketingAnalytics` (in-file helpers — drop calls)

### 3. Panels removed entirely (delete files)

- `src/components/admin/RazorpayTestCheckout.tsx` — dev-only checkout.
- `src/pages/AdminChief.tsx` + `/admin/chief` route — AI burn, no revenue.
- `src/pages/KammattamPopout.tsx` + `/admin/kammattam` route — vanity meter.
- `src/pages/AdminOperations.tsx` + `/admin/operations` route — superseded by the 8 buckets.

(`ChiefBriefing.tsx` and `AiMcpControlCenter.tsx` only get unmounted — kept in repo per "hide, don't delete" for AI features.)

---

### 4. Routes — exact changes (both `AdminRoutes` and `PublicRoutes` in `src/App.tsx`)

**Keep:**
- `/admin` (Home)
- `/admin/users`, `/admin/billing`, `/admin/storage`, `/admin/settings`

**Rename / add:**
- `/admin/content` → `/admin/approvals` (legacy `/admin/content` redirects via `pathToTab` mapping)
- `/admin/support` → `/admin/comms`
- `/admin/reports` → `/admin/audit`
- new: `/admin/catalog`

**Remove (routes + page files):**
- `/admin/super`, `/admin/business`, `/admin/finance`, `/admin/legal`, `/admin/qc`, `/admin/rights`, `/admin/team`, `/admin/kammattam`, `/admin/operations`, `/admin/chief`

Legacy paths above are redirected to their new bucket inside `pathToTab` so old bookmarks still land on the right tab. Drop dead routes from the route table.

---

### 5. Exact files to edit

1. **`src/App.tsx`** — drop 8 admin imports (`AdminChief`, `KammattamPopout`, `AdminOperations`, plus 7 dead route lines × 2 route blocks). Add catalog/comms/approvals/audit. Mirror in `AdminRoutes` and `PublicRoutes`.
2. **`src/pages/Admin.tsx`** —
   - Trim imports to the kept components only.
   - Replace `TabsList` with 8 `DeptTab`s.
   - Rewrite `pathToTab` to map legacy paths → new buckets.
   - Rewrite the 7 `TabsContent` blocks to match the table in §1.
   - Delete `LegacyOnboardingFunnel`, `MarketingAnalytics`, and `rows`-fetching state (no longer rendered).
   - Update `QuickNav` tiles to the 8 buckets.
3. **Delete files:** `src/pages/AdminChief.tsx`, `src/pages/KammattamPopout.tsx`, `src/pages/AdminOperations.tsx`, `src/components/admin/RazorpayTestCheckout.tsx`.

---

### 6. Patch order

1. Edit `Admin.tsx` (single biggest change — tabs, content, helpers, imports).
2. Edit `App.tsx` route tables + drop dead imports.
3. `rm` the 4 dead files.
4. Build check; fix any stale imports the compiler surfaces.

---

### 7. Out of scope (next steps)

- Step 3: Payment provider trim (Razorpay + manual only — `Paddle`, `Fastlink` cuts).
- Step 4: Storage table consolidation.
- Step 5: Edge function disablement.

Reply **"go"** to execute.
