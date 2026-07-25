# StreamVista Creator MVP — Simplify, Restructure, Redesign (Plan Only)

No code, database, storage, migration, secret, GitHub, or deploy changes. GitHub Actions quota resets in 7 days. This plan tells us exactly what to change once you approve.

Design system (locked from your picks):
- Palette: Paper & Ink — `#f5f3ee` bg, `#e8e4dd` surface, `#2d2d2d` ink, `#0d0d0d` deep ink. Single subtle accent only.
- Type: Sora (headings) + Manrope (body). No serif.
- Layout: single column, generous whitespace, macOS-style rounded cards (14–20px radius), soft 1px borders, hairline dividers, no gradients, no glow.
- Voice: plain English. No "storage", "quota", "bucket", "ingest", "QC", "pipeline", "wiring", "MVP" in user-facing copy.

---

## P0 — Ship first (visible, blocking, or misleading)

### 1. Homepage (`src/pages/Index.tsx` + `src/components/streamvista/*`)
Rewrite into one calm single-column story:
1. Hero: "Sell your film. License your show." + one line + two buttons: **I have content** / **I'm a buyer**.
2. Three plain-English steps: Add your title → We check the rights → Buyers make offers.
3. What you can list: Feature Film, Series, Short Film, Documentary, Music Video, Animation.
4. Who buys: OTT, Broadcast, FAST, Satellite, Airlines, Hospitality, AI licensing (opt-in).
5. Trust line + one CTA.
Remove: "Cloud X", "HTTPS Encrypted" chip, duplicate trust badges, "Powered by The Crayons Network" block from hero area (keep once in footer only), duplicate "AI Training & Machine Learning" heading.

Files: `Hero.tsx`, `TrustedDistributionPartners.tsx`, `Workflow.tsx`, `PlatformOverview.tsx`, `SupportedContent.tsx`, `RightsDistribution.tsx`, `AIContentLicensingSection.tsx`, `FinalCta.tsx`, `Footer.tsx`, `Navbar.tsx`.

### 2. Creator submission form — 5 clean steps
Component: `src/components/creator/title/TitleEditor.tsx` + `src/lib/submission/stepDefinitions.ts`.

- **Step 1 Basics** — required: Title, Content type, Primary language, Rights owner. Optional: original title, additional languages, year, runtime, genres, director, key credits. Content type list = Feature Film, Web Series, TV Series, Short Film, Documentary, Music Video, Animation, Vertical Drama, Other. Remove any social-platform publishing (YouTube/IG/FB/X) from the form; park as a future "Publish channels" module.
- **Step 2 Story** — required: Synopsis, Primary poster. Optional (collapsed): logline, short synopsis, cast/crew, keywords, trailer link.
- **Step 3 Preview assets** — required for review: Trailer or approved screener. Optional: teaser, replacement poster. Hide "Advanced Artwork Assets" (banner/tile/square/A/B) behind a "Show advanced" toggle; only unlock after approval. Do not require the full master at draft creation.
- **Step 4 Rights & documents** — separate cards per category. Required before final: Rights owner, territories, rights types, start/end or perpetual, Chain of Title evidence, existing distribution contracts or explicit "No existing contracts", Censor certificate when legally applicable. Optional/conditional: music licences, talent releases, producer agreements, underlying-work permissions, litigation disclosure, exclusivity. Every field labelled with one of: **Required**, **Optional**, **Required if applicable**, **Required before final approval**.
- **Step 5 Review & submit** — plain summary, single "Submit for review" button (uses existing `submitLockRef` + `submit_title_to_admin` RPC), success screen tells creator what happens next.

### 3. Storage / quota copy (misleading today)
No DB changes. UI-only fixes:
- Remove "Vault", "Nilavara A/B/C", "₹767/TB automatic top-up", "90/120-day lifecycle", "Initialize Vault" from any creator-visible surface until they match live contracts (`src/pages/*Vault*`, `src/components/creator/sections/Storage.tsx`, `src/components/workspace/StorageCard.tsx`).
- Replace `StorageLive` labels with plain: "Space used / Space available" + one honest number sourced from the current `recalc_workspace_storage_usage` value. No "quota", "entitlement", "bucket".
- Remove the standalone Storage section from primary creator nav; keep as a small footer chip in Settings.

### 4. Admin dashboard (`src/pages/Admin.tsx` + `src/components/admin/*`)
Reduce to 4 top items: **Inbox**, **Titles**, **Buyers**, **Settings**. Move everything else behind a "More" menu. Kill duplicate Approve/Publish surfaces — the hero buttons already exist in `QuickActions.tsx` and `QCLegalValidationSurface.tsx`; keep the QC/Legal surface only. Remove tabs mixing title workflow with commercial workflow.

### 5. Buyer basic page (`src/pages/landing/Buyers.tsx` + `src/pages/dashboards/Buyer.tsx`)
Public: one hero line, "How buying works" (3 steps), "Request access" form. Dashboard: one list of available titles + saved list + messages. Remove all licensing jargon from public copy; keep detail terms inside signed-in deal flow.

---

## P1 — Wiring & clutter

### 6. Button/handler audit (report only in this plan; fix list to follow)
For each control below we'll produce: component · handler · route/RPC · success/error state · missing wiring.
- Language switcher EN/ML (`LanguageSwitcher.tsx`)
- Guide, Help, Submit ticket (`Contact.tsx`, `support_requests`)
- Storage upgrade/request (`PremiumStorageTopupModal.tsx`, `create-storage-topup`)
- Billing upgrade (`Pricing.tsx`, `create-storage-topup`, `razorpay-webhook`)
- View/Edit/Delete title (`MyTitles.tsx`, `TitleEditor.tsx`, `submit_title_to_admin`)
- Save, Submit, Prev/Next (`TitleEditor.tsx`)
- Upload/replace/version (`AssetUploader.tsx`, `upload_sessions`)
Rule: no visible button without a working handler. Buttons without handlers get hidden until wired.

### 7. Help page — keep to Guides · Contact · Submit ticket · Ticket history. Verify `support_requests` insert is wired. Remove the "1-business-day reply" promise for free tier unless ops signs it.

### 8. Nav & footer
Navbar: Home · How it works · Pricing · About · Contact + Login/Get started. Drop "Solutions", "Creator Preview", "Partners" from primary; move to footer.
Footer: keep once, single trust chip row, no duplicate "Cloud X"/"IP & Copyright Compliance" chips.

---

## P2 — Cleanup / safe deletions (report only; deletion needs separate approval)

Candidates for deletion after reference audit:
- `src/pages/SmartUploads.tsx`, `src/components/uploads/SmartDropUploader.tsx` (already commented out in `App.tsx`).
- Vault landing pages if unreachable and no active consumer.
- Legacy dashboard aliases still redirecting (`/producer`, `/vault`, `/studio`, `/client`, `/projects`, `/archive`, `/team`) once inbound traffic = 0.
- Duplicate trust badge component if unused after home rewrite.

## Roles & dashboards audit (report only)
Existing roles + routes:
- creator/content_owner → `/dashboard/content` ✔
- studio → `/dashboard/studio` ✔ (gated by profile onboarding)
- buyer → `/dashboard/buyer` ✔
- founder/platform_owner/super_admin/admin → `/admin/*` ✔
- QC / Legal / Finance / Support → **no dedicated dashboard**; today they use `/admin` with role checks inside components. Recommend adding filtered admin views later, not new buckets or grants. No new storage buckets, no frontend-only grants.
- RLS gaps to revisit later (not in this batch): `title_review_assignments` filtering for QC-only users; `revenue_lines` workspace scoping already tightened in pending migration.

## Required / Optional field matrix (Creator submission)

```text
Step 1 Basics
  Required:  title, content_type, primary_language, rights_owner
  Optional:  original_title, additional_languages, year, runtime, genres, director, credits

Step 2 Story
  Required:  synopsis, primary_poster
  Optional:  logline, short_synopsis, cast, crew, keywords, trailer_url

Step 3 Preview assets
  Required (for review): trailer_or_screener
  Optional:  teaser, replacement_poster
  Hidden until approved: banner, tile, square, A/B artwork, full master

Step 4 Rights
  Required before final: rights_owner, territories, rights_types,
                         rights_window (start/end | perpetual),
                         chain_of_title_doc, existing_contracts_or_none,
                         censor_certificate_if_applicable
  Conditional:           music_licences, talent_releases, producer_agreements,
                         underlying_work_permissions, litigation_disclosure,
                         exclusivity_restrictions

Step 5 Review & submit
  Required:  read summary, single Submit button
```

## Storage math — current vs suspected mismatch
Source of truth today: `recalc_workspace_storage_usage()` treating `recent_uploads` as canonical (fixed in prior batch). UI still shows several derived numbers (entitlement + adjustments + top-ups) that don't visually reconcile. Plan: show only one number ("Used X of Y") + link to detailed breakdown. No SQL change.

## Tests to add (once implementation begins, not now)
- `homepage-simple-copy.test.ts` — asserts hero copy, no "Cloud X", no duplicate trust.
- `creator-submission-steps.test.tsx` — five stages, required-field matrix per step.
- `admin-nav-4-items.test.tsx` — top nav = 4.
- `button-wiring.test.tsx` — every rendered `<button>` in creator/admin/buyer has an `onClick` or `type="submit"` inside a form.
- Extend existing `dashboard-routing-no-loop.test.ts`.

## Migrations
None in this batch. Kept non-executed. All changes above are frontend/copy.

## Risks & rollback
- Copy changes are low-risk; revert = git revert per file.
- Hiding buttons rather than deleting them keeps handlers intact if we need to restore.
- No RLS, no bucket, no function, no secret touched.
- No deploy until you approve.

## What I need from you to start
1. "Approved — start P0" (home + submission + admin trim + buyer basic + storage copy).
2. Whether to hide or delete the Vault pages.
3. Confirm the four admin top-nav items (Inbox / Titles / Buyers / Settings) or propose alternates.
