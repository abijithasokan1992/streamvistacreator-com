
## Goal

Replace the scattered Channel Partner / Onboarding / Invitations surfaces with one **Admin → Ecosystem** department that manages every external organization (Creator, Studio, Buyer, Channel Partner) through a single data model, invitation flow, and audit trail. The public `/partners` page becomes a read-only projection of published Channel Partner records.

## Reused existing pieces (no rebuild)

- Admin shell: `src/pages/Admin.tsx` + `AdminCommandBar` + `DeptSubNav` (add one new dept, not a new page).
- Auth / RBAC: `useAuth`, `RoleGate`, `has_role`, existing `user_roles` table.
- Audit: `admin_audit_log` (existing helper patterns).
- Onboarding data: `onboarding_requests`, `onboarding_notifications`, `onboarding_audit_log` — kept as source, wrapped in new views instead of forked tables.
- Invitations: existing `role_invitations`, `premium_invitations`, `intro_invites` — unified behind one admin surface, not replaced.
- Workspaces: existing `workspaces`, `workspace_members`, `organizations` auto-provisioner (already used by onboarding approval flow).
- Partner data: existing `partner_profiles` becomes the Channel Partner projection layer; existing `partner_logos` stays for marketing thumbnails only.

## Data model (additive, no duplication)

One new organization-type discriminator table + one linking column. Everything else references existing tables.

```text
organizations (existing)
  + org_kind enum: 'creator' | 'studio' | 'buyer' | 'channel_partner'    NEW COLUMN
  + status enum:  'draft' | 'invited' | 'onboarding' | 'active' | 'suspended'  NEW COLUMN
  + published boolean default false   NEW COLUMN   (only channel_partner uses)
  + partner_profile_id uuid FK partner_profiles(id) nullable  NEW COLUMN

partner_profiles (existing) — becomes the extended profile for org_kind='channel_partner'
  + organization_id uuid FK organizations(id)  NEW COLUMN (1:1)
  + Reserved future columns already present (licensing, territories, submission_requirements)

onboarding_requests (existing) — unchanged; gains implicit link via organization_id already present.

role_invitations (existing) — reused; a new admin view groups all invitation types.
```

RLS: admin full access; `anon` can `SELECT` on `partner_profiles` only where the linked org is `org_kind='channel_partner' AND published=true AND status='active'`. Authenticated users get the same public view; a future migration will add a creator-scoped policy exposing the extended licensing/submission columns (already reserved).

Grants included in the migration for every touched table.

## Admin → Ecosystem UI

New dept in `Admin.tsx`, key `ecosystem`, four sub-sections in `DeptSubNav`:

1. **Organizations** — table of all orgs across the four kinds; filters by kind/status; row detail drawer shows workspace, members, linked onboarding request, audit trail. Reuses existing `AdminTeamManager` row components.
2. **Invitations** — unified list over `role_invitations` (all roles including `channel_partner`). Create-invite dialog picks `org_kind`; on acceptance the existing onboarding flow runs with role-aware steps.
3. **Channel Partners** — filtered view of Organizations where `org_kind='channel_partner'`, plus the partner_profile editor (tagline, description, logo, licensing, territories, submission requirements) and a **Publish** toggle that flips `organizations.published`. This replaces the standalone Channel Partners module and the current `PartnerLogos` admin card links here.
4. **Onboarding Queue** — the existing `OnboardingApprovals` component moved under Ecosystem (removed from Operations dept nav; route redirect kept). Approving still calls the same provisioning code path.

Legacy routes `/admin/approvals`, `/admin/users` continue to work — `pathToDept` gets an `ecosystem` branch and legacy tab keys `approvals`, `partners`, `invitations` map into it.

## Onboarding + provisioning

One shared server-side function `provision_organization(org_kind, submitter_user_id, payload)` (Postgres function, `security definer`) that:

- inserts/updates the `organizations` row with the right `org_kind`,
- creates the workspace + `workspace_members` owner row,
- links the `onboarding_request`,
- for `channel_partner` also inserts the `partner_profiles` row (unpublished),
- writes an `admin_audit_log` entry.

Both admin approval and invitation acceptance call this same function — no forked logic.

## Public `/partners`

`src/pages/Partners.tsx` and `src/lib/partnerProfiles.ts` are updated to query:

```sql
select pp.*
from partner_profiles pp
join organizations o on o.id = pp.organization_id
where o.org_kind = 'channel_partner'
  and o.published = true
  and o.status = 'active'
```

No admin action = no listing. Draft partners never appear.

## Creator workspace future hook (not built now, but reserved)

The migration adds columns `licensing_models jsonb`, `submission_requirements jsonb`, `territories text[]` on `partner_profiles` (if not already present) plus an RLS policy stub commented out for `authenticated` role. A follow-up story enables it — no schema churn required later.

## Files to touch

- New migration: `organizations` columns + enum, `partner_profiles.organization_id`, RLS/grants, `provision_organization` function, backfill of existing partner rows.
- New: `src/components/admin/ecosystem/EcosystemDashboard.tsx`, `OrganizationsTable.tsx`, `InvitationsConsole.tsx`, `ChannelPartnersConsole.tsx`, `PartnerProfileEditor.tsx`.
- Edit: `src/pages/Admin.tsx` (register `ecosystem` dept + sub-sections; move `OnboardingApprovals` there; keep legacy tab redirects).
- Edit: `src/components/admin/AdminCommandBar.tsx` + `DeptSubNav.tsx` to surface the new dept and its sections.
- Edit: `src/pages/Partners.tsx`, `src/lib/partnerProfiles.ts` to filter on `published=true`.
- Delete/redirect: any standalone `ChannelPartners*` page or route (there is none currently; only `PartnerLogos` admin card, which becomes a link into Ecosystem → Channel Partners).

## Rollout order

1. Migration (schema + function + backfill + RLS).
2. Ecosystem admin UI wired to existing components.
3. Partners public page filter switch.
4. Redirect legacy admin routes.

## Out of scope

- Creator-authenticated partner extension UI (reserved data only).
- AI compatibility scoring changes (existing `partner_title_matches` untouched).
- Any changes to Studio/Buyer dashboards.
