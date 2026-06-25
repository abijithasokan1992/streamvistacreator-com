
## Step 1 — Route + Creator Section Cleanup

Goal: one dashboard system (`/dashboard/{role}`), one Creator sidebar (7 sections). No behavior change to admin, billing, public, or share/review tokens.

---

### 1. Routes — exact actions (src/App.tsx, PublicRoutes block)

**Remove (delete route + import):**
- `/home` (duplicate of `/`)
- `/vault` → legacy `Vault.tsx`
- `/studio` → legacy `Studio.tsx`
- `/archive` → `MasterArchive.tsx`
- `/team` → `Team.tsx`
- `/dashboard/localization` → `LocalizationDashboard`
- `/dashboard/distribution` → `DistributionDashboard`
- `/ingest-test` → `IngestTest`
- `/launching-special-plan` → `LaunchingSpecialPlan`

**Redirect to canonical (`<CanonicalDashboardRedirect />`, already used for `/producer`, `/client`, `/projects`):**
- `/vault`, `/studio`, `/archive`, `/team`, `/dashboard/localization`, `/dashboard/distribution`
- Keep `/producer`, `/client`, `/projects` redirects (already correct).

**Keep as-is:**
- `/dashboard`, `/dashboard/content`, `/dashboard/studio`, `/dashboard/buyer`
- `/onboarding`, `/auth*`, `/reset-password`, `/admin/*`
- `/checkout/*`, `/billing/status/:topupId`, `/invoice/*`
- `/s/:token`, `/review/:token`, `/screening/:token`
- `/pricing`, `/about`, `/contact`, `/support`, `/terms`, `/privacy`, `/refund`, `/ip-copyright`, `/dmca`, `/unsubscribe`
- `/blog/*`, `/c2c-setup`

**Files to delete (no remaining importers after route cut):**
- `src/pages/Vault.tsx`
- `src/pages/Studio.tsx`
- `src/pages/MasterArchive.tsx`
- `src/pages/Team.tsx`
- `src/pages/IngestTest.tsx`
- `src/pages/LaunchingSpecialPlan.tsx`
- `src/pages/dashboards/Localization.tsx`
- `src/pages/dashboards/Distribution.tsx`

Verify zero remaining imports with `rg` before delete; if any internal link points at them, swap to `/dashboard/content` (or remove).

---

### 2. Creator sections — keep / hide / remove

**Keep (MVP sidebar, 7 items):**
`Home`, `MyTitles`, `Submissions`, `Updates`, `DeliveryVault`, `Statements` (Billing), `Help`

**Remove (delete file + import + sidebar entry):**
- `src/components/creator/sections/Insights.tsx`
- `src/components/creator/sections/Schedule.tsx`
- `src/components/creator/sections/Upgrade.tsx` (CTA moves into `Statements`/Home checklist)
- `src/components/creator/sections/ComingSoonGrid.tsx`

---

### 3. Files to edit

1. **`src/App.tsx`** — drop 8 routes + matching imports, add 6 redirects to `CanonicalDashboardRedirect`.
2. **`src/pages/dashboards/ContentOwner.tsx`** — remove imports + switch cases for `insights`, `schedule`, `upgrade`, `comingsoon`; default unknown section → `home`.
3. **`src/components/creator/CreatorSidebar.tsx`** — prune nav array to the 7 kept sections; update `CreatorTour` step IDs if any reference removed tabs.
4. **`src/components/creator/CreatorTour.tsx`** — drop steps tied to removed sections (insights/schedule/upgrade), keep tour to ≤6 stops.
5. **`src/components/creator/sections/Home.tsx`** — replace any `setSection("upgrade")` / `"insights"` links with `"billing"` or remove the card.
6. **Delete files** listed in sections 1 + 2.

---

### 4. Patch order (single PR, safe sequence)

1. `rg` sweep for importers of each legacy page/section → list collateral.
2. Edit `App.tsx` (routes + imports).
3. Edit `ContentOwner.tsx` (sections registry).
4. Edit `CreatorSidebar.tsx` + `CreatorTour.tsx` + `Home.tsx` (nav/CTA refs).
5. `rm` the 12 dead files.
6. Build check — fix any stray import surfaced by the compiler.

---

### 5. Out of scope (next steps)

- Step 2: Admin panel collapse (50 → 8).
- Step 3: Payment provider trim (Razorpay + manual only).
- Step 4: Storage table consolidation.

Reply **"go"** to execute, or call out anything to keep that I marked for removal.
