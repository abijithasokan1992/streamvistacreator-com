# StreamVista → Role-Based Media OS (Approved with changes)

Phased refactor. One phase per turn, review between.

## Approved deltas from the user
1. **Role migration**: `executive_producer` → **Content Owner** (not Studio).
2. **Public signup restricted to 3 roles**: Content Owner, Studio, Buyer.
   - Localization Partner, Distributor, Admin, Super Admin are **invite-only** (admin-assigned).
3. **Content Lock workflow** after submission — once a title is submitted for review it becomes immutable until an admin/owner unlocks or approves it.
4. **No placeholder dashboard cards** — each role dashboard ships only with real, wired-up modules. Empty states are honest ("No titles yet").
5. **Licensing / Acquisition requests for Buyers** — buyers can submit acquisition requests against any catalog title; routed to the Content Owner for accept/decline/counter.
6. **Full content approval lifecycle**: `draft → submitted → in_review → changes_requested → approved → locked → published → archived` with audit trail.
7. **OCI configuration is view-only** in Admin / Super Admin UI. No edit/delete buttons. Values come from existing secrets and remain untouched.
8. **Public site** = Create Account · Log In · Contact Us only. No marketing CMS, no plan cards, no testimonials, no partner logos.
9. **Preserve as-is**: Oracle Database, Oracle Object Storage (OCI), Razorpay (orders, subscriptions, webhooks, audit log). No schema or function changes to those subsystems.

## Defaults already locked
- Additive DB migration — nothing existing is dropped.
- Magic link is the only public auth path. Google OAuth kept as one-click alt. Password UI removed from client.
- Existing passwords stay in `auth.users` for break-glass.

---

## Phase 1 — DB foundation (this turn)

New enums:
- Extend `app_role` with `content_owner`, `studio`, `buyer`, `localization_partner`, `distributor`, `super_admin`.
- New `content_status`: draft, submitted, in_review, changes_requested, approved, locked, published, archived.
- New `acquisition_status`: pending, accepted, declined, countered, withdrawn.

New tables (all with GRANTs → RLS → policies):

```
plans               role-scoped plan catalogue (admin-managed)
plan_assignments    user/org → plan, with grant/suspend/lifetime/promo
vouchers            code, %/fixed, expiry, usage limit, scope
voucher_redemptions audit of voucher uses
storage_allocations admin-granted storage on top of plan
platform_settings   super-admin global key/value
content_titles      title-level record with content_status + locked_at + locked_by
content_approvals   approval log: actor, from_status, to_status, note, at
acquisition_requests buyer → title, terms, status, counter_terms
invitations         invite-only roles (localization_partner, distributor, admin)
```

Helper functions:
- `current_dashboard_role()` — maps legacy roles (creator/executive_producer/client) to new ones and returns the canonical dashboard role.
- `is_super_admin()` — already exists, reused.
- `lock_content(title_id)` / `unlock_content(title_id)` — SECURITY DEFINER, audit-logged.
- `can_signup_as(role)` — only allows content_owner/studio/buyer via the public path.

Legacy role mapping (used at login + by `current_dashboard_role`):
- `executive_producer` → `content_owner`
- `creator` → `content_owner`
- `client` → `buyer`
- `admin` stays `admin`
- first admin can be promoted to `super_admin` from Admin Console

## Phase 2 — Magic-link auth + role-restricted signup
- `/auth` with Create Account (Full Name, Email, Role ∈ {Content Owner, Studio, Buyer}) and Log In (Email only).
- `signInWithOtp` for both. Callback applies `set_initial_role` only when role is in the allowed set.
- Role-based redirect: content_owner→`/dashboard/content`, studio→`/dashboard/studio`, buyer→`/dashboard/buyer`, localization_partner→`/dashboard/localization`, distributor→`/dashboard/distribution`, admin→`/admin`, super_admin→`/admin/super`.

## Phase 3 — Public site reduction
- `Index.tsx`: remove Hero plan grid, CmsHeroBanners, CmsAdZone, PlanFeature, CmsFeaturedFilms, ComparisonTable, Testimonials, CmsNewsEvents, CloudStudioPartners, Pricing.
- New minimal landing: headline, sub-line, "Create your account and choose the plan that fits your workflow.", primary **Create Account**, secondary **Log In**.
- Header: Logo · Create Account · Contact Us · Log In.
- Footer: Terms · Privacy · DMCA · Support.

## Phase 4 — Real role dashboards (no placeholders)
- Content Owner: title list, upload, submit-for-review, lock state, revenue snapshot (real data only).
- Studio: productions, deliverables, review links (existing components).
- Buyer: licensed catalog, **Submit Acquisition Request** form, request status list, invoices.
- Localization Partner: assigned titles, deliverable upload (invite-only access).
- Distributor: distribution windows, territory rights (invite-only access).

If a module has no data source yet, it's hidden — not shown as a stub.

## Phase 5 — Content approval + lock lifecycle
- Status machine enforced by DB triggers.
- "Submit for review" transitions draft→submitted and locks the title.
- Admin/Owner actions: approve, request changes, unlock, publish, archive — all audited in `content_approvals`.
- Buyer's acquisition requests flow into Content Owner inbox.

## Phase 6 — Dynamic pricing + voucher UX
- Auth-gated `/pricing` reads `plans` filtered by user's role + active + visibility=public.
- Voucher box on checkout; server-side `redeem-voucher` edge function.
- Razorpay order amount = `plan.price_amount` + `plan.gst_percent` - voucher discount. **No changes to Razorpay code paths** beyond reading the dynamic amount.

## Phase 7 — Admin & Super Admin
- Admin: Users, Orgs, Roles, Plans CRUD/archive/duplicate, Vouchers, Storage allocations, Invitations, Approvals queue, Acquisition requests, Content lock overrides, Notifications.
- Super Admin: Platform settings, feature flags, audit logs, payment settings (view), **OCI config view-only**, email config.

---

## Hard constraints
- **No edits** to: `supabase/functions/oci-*`, `oracle-proxy`, `create-razorpay-*`, `verify-razorpay-*`, `razorpay-webhook*`, `razorpay-admin`, `_shared/oci.ts`, `_shared/razorpay-config.ts`, `oracle-gateway.ts`, `ociMultipartUpload.ts`.
- No drops of existing tables. Marketing components stay in repo but are unlinked from routes.
- Passwords kept in `auth.users`; UI never offers password sign-in.

## Delivery
After each phase I stop and wait. Phase 1 (DB migration) goes out next.
