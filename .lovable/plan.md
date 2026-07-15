## AI Training Content Licensing — Implementation Plan

Scope is large; I'll ship in 4 sequential batches, each independently verifiable. No existing UI, titles, assets, or rights records are altered destructively. All new AI-rights fields default to "not reviewed" / disabled.

---

### Batch 1 — Public marketing surface + legal corrections (frontend only)

**Files touched**
- `src/components/Hero.tsx` or nearest Rights & Distribution block → add "AI Training & Machine Learning" chip alongside OTT/Broadcasters/FAST/Airlines/Hospitality/Educational.
- `src/components/home/AIContentLicensingSection.tsx` (new) → "License Content for Responsible AI" band with two CTAs (`I Own Content` → `/onboarding`, `Request an AI Dataset` → `/solutions/ai-content-licensing#request`). Slotted into `Index.tsx` under existing rights section — does NOT replace hero.
- `src/pages/SolutionsAIContentLicensing.tsx` (new) → 7 sections exactly as specced (Overview → CTAs). Added to `App.tsx` route `/solutions/ai-content-licensing` + `scripts/prerender-routes.ts` for route-specific meta.
- `src/components/Footer.tsx` → correct legal name to `© 2026 STREAMVISTA (OPC) PRIVATE LIMITED · Ernakulam, Kerala, India.`
- Audit trust-claim strings across `Footer.tsx`, `Pricing.tsx`, `Hero.tsx`, `Contact.tsx`:
  - "100% Secure Payments" → "Secure Payment Processing" (Razorpay is wired ⇒ allowed)
  - "99.9% Uptime SLA" → remove (no contractual SLA)
  - "DMCA Protected" → "IP & Copyright Compliance"
  - "Free forever" → "Free plan available"
  - "256-bit SSL" → remove unless we can confirm HTTPS everywhere (keep only if literally rendered nowhere sensitive; safer to remove)

**Verify:** hero unchanged, new section renders, `/solutions/ai-content-licensing` loads, footer legal name correct, no unsupported claims remain (rg sweep).

---

### Batch 2 — Database schema (single migration)

New tables (all RLS-on, workspace-scoped, service_role full, authenticated scoped by workspace membership or admin role):

1. `title_ai_licensing` (1:1 with `content_titles`)
   - `title_id` FK, `workspace_id`, `available_for_review` (`yes|no|undecided`, default `undecided`), `rights_holder_authorized` (`yes|no|pending`, default `pending`), `approved_use_cases text[]`, `prohibited_use_cases text[]`, `licence_term`, `territory`, `exclusivity` (`exclusive|non_exclusive|unspecified`), `commercial_model`, `performer_consent_status`, `music_rights_status`, `source_master_available bool`, `resolution`, `frame_rate`, `lip_sync_qc_status`, `audio_languages text[]`, `subtitle_languages text[]`
   - Review workflow: `review_status` enum (`not_submitted|rights_review_required|technical_review_required|clarification_requested|eligible_for_matching|not_eligible|licensed|suspended`, default `not_submitted`)
   - `reviewed_by`, `reviewed_at`, `admin_notes` — kept in sibling `title_ai_licensing_admin` table (admin-only RLS) to prevent creator leak (matches pattern used for `commercial_requests_admin`).

2. `title_ai_licensing_documents` — private references to storage objects (chain-of-title, consent, music rights). Not publicly listable.

3. `ai_buyer_requirements` — the buyer intake form (all 19 fields). RLS: insertable by authenticated (public form → allow anon INSERT via edge function), readable admin-only.

4. `ai_licensing_opportunities` — internal buyer opportunity records (SHAIP-style). Admin-only RLS.

5. `ai_licensing_matches` — join between `title_ai_licensing` and `ai_licensing_opportunities`. Admin-only.

6. `ai_licensing_audit_log` — document access + status changes.

**Trigger `enforce_ai_licensing_review_transitions`:** creators can only set `available_for_review` / edit their-own metadata; only admins may change `review_status`, `rights_holder_authorized` to `yes`, or move to `eligible_for_matching` (requires non-null admin doc references).

**Seed:** insert SHAIP #700 opportunity record with all fields "Pending clarification" as specified. Private (admin RLS).

**Grandfathering:** no data mutation of existing `content_titles`. `title_ai_licensing` rows are lazily created on first save — absence = "AI rights not reviewed".

---

### Batch 3 — Creator dashboard AI Licensing panel

- `src/components/creator/sections/TitleAILicensingPanel.tsx` (new) → collapsible section within existing title editor. Read-only display of admin fields; editable creator fields; upload widget writes to private storage bucket `title-ai-rights-docs` (created via migration).
- `src/lib/creator/aiLicensingApi.ts` (new) → typed wrappers.
- Copy: "Submitting content for AI review does not grant AI training rights. StreamVista reviews rights and only qualifies content after written authorization."
- Never shows a "self-approve" toggle.

**Verify:** existing titles show "AI rights status: Not reviewed"; save persists; unauthorized status transitions rejected by trigger.

---

### Batch 4 — Admin review console + public buyer form

- `src/pages/AdminAILicensing.tsx` (new, route `/admin/ai-licensing`, gated by `has_role('admin')`) → queue by `review_status`, per-title review drawer with all admin controls, match to opportunity, record proposal / contract / delivery.
- `src/pages/SolutionsAIContentLicensing.tsx#request` → embeds `AIBuyerRequirementForm.tsx` (new). Public submit posts to edge function `submit-ai-buyer-requirement` that validates + writes `ai_buyer_requirements` with rate limiting.
- `supabase/functions/submit-ai-buyer-requirement/index.ts` (new).

**Security guarantees enforced end-to-end:**
- Private rights docs stored in a bucket with no public list, signed-URL only, admin-only download in Phase 1.
- Buyers never receive master URLs; matching = internal note only.
- SHAIP #700 details never rendered on public pages.

---

### Deliverables on completion
- Route/component inventory, migration diff, RLS matrix, list of corrected legal claims, before/after screenshots of home + footer + new AI page (desktop + mobile), and explicit confirmation that no existing title was opted into AI licensing.

---

If this plan looks right I'll start with Batch 1 (public page + legal). Reply "go" or edit any batch.