# Creator RC1 — Milestone Closed

**Milestone:** Creator RC1
**Status:** ✅ Design Frozen · ✅ Feature Frozen · ✅ Operationally Frozen
**Closed on:** 2026-07-12
**Owner:** Founder

---

## Change Control Policy (post-freeze)

Only the following changes are permitted against the Creator Workspace surface:

1. **Security fixes** — CVE remediation, RLS gaps, auth bypasses.
2. **Production bug fixes** — user-visible defects in already-shipped Creator flows.
3. **Regression fixes** — behavior that worked in RC1 and later broke.
4. **Legal / compliance changes** — regulatory, DMCA, tax, GST, data-protection.

**Explicitly disallowed** without a new milestone:
- New Creator features
- New Creator tabs / sub-tabs
- Workflow redesign
- UI restructuring

All operational enhancements (bulk actions, reviewer routing, ops dashboards, deeper CMS controls, etc.) belong to the **Admin Command Center** or a later platform phase.

---

## Modules Included in RC1

| Module | Scope | Surface |
|---|---|---|
| Dashboard | Overview cards, quick actions | `/dashboard`, `/creator/dashboard` |
| Title Editor (5 tabs) | Overview · Assets · Media CMS · Commercial · Distribution | `/creator/title/:id` |
| Assets Tab | Slot-driven uploads, SHA-256 dedupe, quota preflight, lock-aware | `AssetUploader.tsx` |
| Media CMS Tab | Structure (Creator-editable), Collections, Media Versions, Localization (read-only), Publishing (read-only), Delivery (read-only) | `MediaCmsPanel.tsx` |
| Commercial Tab | Rights availability, contact channel, non-terminal statuses only | `CommercialPanel.tsx` |
| Distribution Tab | Read-only status view (partners, queue, deliveries) | `Distribution.tsx` |
| Submission & Lock Lifecycle | Draft → Submitted → In Review → Changes Requested → Approved/Rejected | `content_titles.status` + `trg_enforce_title_lock` |
| Removal Requests | Creator-initiated takedown with audit trail | `title_removal_requests` |
| Workspace Storage | Quota preflight, entitlement/usage read | `useWorkspaceStorage` |
| Notifications & Email | Transactional delivery, retry sweeper, DLQ, suppression list | `retry-failed-emails`, `email_send_log` |
| Auth & Roles | `content_owner` role, workspace membership | `user_roles`, `has_role()` |

---

## Modules Intentionally Excluded from RC1

Deferred to Admin Command Center or later phases. **Do not re-add to Creator surface.**

| Excluded | Reason | Future home |
|---|---|---|
| `DistributionHub.tsx` (removed) | Creators do not operate distribution | Admin Command Center |
| `TitleDistributionPanel.tsx` (removed) | Superseded by read-only Distribution tab | Admin Command Center |
| Creator write access to `title_localizations` | Localization is Admin-managed post-submission | Admin |
| Creator write access to `title_publishing` | Publishing schedule/approval is Admin-owned | Admin |
| Creator write access to `distribution_queue` / `distribution_packages` | Distribution ops are Admin-only | Admin |
| Terminal `right_status` values (`sold`, `blocked`) from Creator | Prevent Creator-side self-locking | Admin |
| Bulk title actions | Ops-scale workflow | Admin Command Center |
| Reviewer routing, QC dashboards | Reviewer-side surface | Admin (`IngestQCPanel` now under `src/components/admin/`) |
| `run-qc-scan` invocation from Creator | Admin/Ops/Moderator only (403 for Creator) | Admin |
| Creator-facing `TitleStructurePanel` (Batch D) | Explicitly deferred | Later platform phase |
| Creator-facing Rights terminal-state escalation | Requires legal + Admin workflow | Admin + Legal |

---

## Frozen Routes (Creator surface)

```
/                          Public homepage
/auth                      Auth
/dashboard                 Creator dashboard (alias: /creator/dashboard)
/creator/titles            Titles list
/creator/title/new         Create draft
/creator/title/:id         Title editor (5 tabs)
/creator/title/:id/assets
/creator/title/:id/media-cms
/creator/title/:id/commercial
/creator/title/:id/distribution     (read-only)
/creator/storage           Workspace storage view
/creator/removals          Takedown requests
/settings                  Account/workspace settings
```

Any new Creator route requires a post-RC1 milestone.

---

## Frozen Database Surfaces (Creator-visible)

**RLS is authoritative. All Creator writes flow through these tables only.**

### Creator-writable (lock-gated by `is_title_editable_by_creator`)
- `content_titles` (owner columns; status transitions gated by trigger)
- `title_assets`
- `title_media_versions`
- `title_franchises`, `title_collections`, `title_collection_items` (owner scope)
- `title_commercial_profiles` (non-internal columns; internal notes via SECURITY DEFINER RPC only)
- `title_rights_availability` (non-terminal values only; `WITH CHECK` enforced)
- `title_removal_requests` (INSERT only)
- `upload_sessions`, `workspace_storage_usage` (via server-side flows)
- `contact_messages` (INSERT only)

### Creator-readable, Admin-writable
- `title_localizations` — SELECT-only for owner
- `title_publishing` — SELECT-only for owner
- `title_edit_requests`, `title_review_*` — SELECT-only where scoped to owner
- `distribution_*` (queue, packages, deliveries, partners, program_offers, metadata_mappings, delivery_logs) — SELECT-only or fully Admin
- `workspace_storage_entitlements`, `workspace_storage_admin_adjustments` — SELECT-only

### Server-side helpers frozen
- `public.is_title_editable_by_creator(uuid)`
- `public.has_role(uuid, app_role)`
- `trg_enforce_title_lock` on `content_titles`
- `trg_ct_lock_guard` on `content_titles`
- `right_status` enum: `available, hold, sold, blocked, none, discuss, premium_required, not_available`

Any schema change touching the above requires a security/regression/compliance justification per the change-control policy.

---

## Frozen APIs

### Edge Functions (Creator-invocable)
| Function | Role gate | Notes |
|---|---|---|
| `assistant-chat` | authenticated | Dual-provider (Lovable AI + Gemini) |
| `agent-chat` | founder/admin | Not Creator-invocable |
| `razorpay-webhook` | signature-verified | No auth surface |
| `retry-failed-emails` | scheduler / admin | Idempotent, terminal-dedup |
| `distribution-dispatch` | admin | 403 for Creator |
| `run-qc-scan` | admin / super_admin / moderator | **403 for Creator** |
| `evaluate-ingest-alerts` | admin | Auth-gated |

### Client APIs (frozen module surface)
- `src/lib/creator/titleApi.ts` — title CRUD, submission, lock-aware
- `src/lib/creator/mediaCmsApi.ts` — CMS mutations with `assertMutationAffectedRows` guard
- `src/lib/creator/assetsApi.ts` — SHA-256 fingerprint + quota preflight
- `src/hooks/useWorkspaceStorage.ts` — read-only entitlement/usage
- `src/integrations/supabase/client.ts` — auto-generated, do not edit

**Regression contract (recorded):** PostgREST unauthorized UPDATE/DELETE returns HTTP 200 with zero rows. Every Creator-side mutation against lock-gated tables pairs `.select("id")` with `assertMutationAffectedRows(...)` — treating a zero-row response as failure, never success.

---

## Remaining Technical Debt

Tracked but out of scope for RC1. Address only under the change-control policy.

1. **`partner_profiles_public` view** — "Security Definer View" scanner finding accepted as documented risk with regression tests. Revisit when Postgres supports view-level invoker rights cleanly.
2. **Types loose-typing in `mediaCmsApi.ts`** — `const sb = supabase as any` pending post-migration types regeneration. Tighten after next `types.ts` roll.
3. **Overlapping ledger tables** — `billing_ledger_events`, `revenue_lines`, `revenue_transactions`, `royalty_allocations` have unclear ownership. Consolidation deferred to Billing v2.
4. **GST split (CGST/SGST/IGST)** — `invoices` stores aggregate only. Compliance gap documented; India tax phase pending.
5. **Refund entitlement reversal** — subscription refunds do not always reverse entitlement grants atomically. Documented in RC1 Payment Audit.
6. **Subscription idempotency** — Razorpay subscription webhooks lack full idempotency key coverage. Ledger dedupe compensates today.
7. **`invoices.total_amount` shim** — some queries rely on computed column; migrate to stored total when Billing v2 lands.
8. **Admin dashboard payment enum** — legacy `error` enum value referenced in stale code paths; not user-facing.
9. **Recent uploads publication filter** — creator scope leaks some system rows; cosmetic, not a data leak.
10. **DIT Ingest bucket provisioning** — bucket seeded manually; not idempotent from migrations.

---

## Known Backlog (post-RC1, non-Creator)

Belongs to Admin Command Center or later phases. **Not** to be built inside the Creator surface.

- Admin Command Center v1 (bulk ops, reviewer routing, ops dashboards)
- Localization workbench (Admin)
- Publishing scheduler (Admin)
- Distribution partner onboarding + credential vault (Admin)
- Rights terminal-state workflow with legal sign-off
- Royalty allocation UI (Admin + Partner)
- Partner statements delivery
- MCP Control Server Phase 2 (write tools)
- Media Asset domain model rollout (see `schemas/GAP_ANALYSIS.md`)
- Reviewer QC dashboards (extends relocated `src/components/admin/IngestQCPanel.tsx`)
- Storage top-up self-service (Creator read-only today)
- Advanced analytics / intelligence snapshots surface

---

## Verification State at Freeze

- ✅ Batches A, B, C accepted (Founder verified 2026-07-12)
- ✅ Regression fixes R1 (silent-deny guard) + R2 (Media CMS read-only) accepted
- ✅ Database migrations, trigger, enum, RLS policies — **live**
- ✅ `run-qc-scan` server-side gate — **deployed**
- ⚠️ Frontend production publish — **not yet performed** (pending explicit Founder approval)
- ✅ Regression contract documented (PostgREST silent-deny)
- ✅ `IngestQCPanel` relocated to `src/components/admin/` — zero Creator imports

---

## Sign-off

**Creator RC1 milestone: CLOSED.**
Freeze effective immediately. Future changes must cite one of the four permitted change categories and reference this document.
