# StreamVista User & RBAC Architecture

_Reference. No backend, database, or RBAC engine changes are implied by this document._

The permission model has **four independent layers**. A single user account carries an
Account Type, may hold zero or one Platform Role, may hold different Organization Roles
in different organizations, and may hold different Production Roles across different
productions.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Layer 1  Account Type       Creator · Studio · Buyer          (public)       │
│  Layer 2  Platform Role      Super Admin · Platform Admin ·                  │
│                              Reviewer · Support                (invite-only) │
│  Layer 3  Organization Role  Owner · Admin · Manager ·                       │
│                              Member · Viewer                   (per org)     │
│  Layer 4  Production Role    Producer · Director · DIT · …     (per prod)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Single source of truth for UI labels: [`src/lib/rbac/labels.ts`](../src/lib/rbac/labels.ts).

---

## Layer 1 — Account Type (public registration)

The **only** account types available at public sign-up:

| Label   | Backend `app_role` | Sign-up route                              |
| ------- | ------------------ | ------------------------------------------ |
| Creator | `content_owner`    | `/auth?intent=signup&role=content_owner`   |
| Studio  | `studio`           | `/auth?intent=signup&role=studio`          |
| Buyer   | `buyer`            | `/auth?intent=signup&role=buyer`           |

- Selection UI: `src/pages/Auth.tsx` (`ROLE_OPTIONS`).
- Marketing entry points: `src/components/streamvista/RoleSurfaces.tsx`.
- Post-registration dashboard is chosen by `dashboardForRole` in `src/hooks/useAuth.tsx`.

No other account types are exposed publicly. Dormant enum values
(`creator`, `client`, `moderator`, `user`, `executive_producer`, `distributor`,
`localization_partner`) are collapsed onto `content_owner` / `buyer` by
`toDashboardRole()` and never appear in a UI selector.

---

## Layer 2 — Platform Role (invite-only staff)

Invite-only. **Never** shown to public users. Access to `/admin/*` and reviewer routes
is enforced by `has_role()` in the database.

| Canonical role   | Backing `app_role`         | Purpose                          |
| ---------------- | -------------------------- | -------------------------------- |
| Super Admin      | `super_admin`              | Root of platform trust.          |
| Platform Admin   | `admin`                    | Day-to-day platform operations.  |
| Reviewer         | `qc_reviewer`, `legal_reviewer` | Editorial and legal review queues. |
| Support          | (delivered via `admin_staff_permissions`) | Customer / operations support. |

Granted from `src/components/admin/RolesManager.tsx`. Fine-grained ops permissions
(finance, billing, refunds, storage adjustments, etc.) are layered through
`admin_staff_permissions` and surfaced in `AdminTeamManager.tsx` — never in
end-user UI.

---

## Layer 3 — Organization Role (per workspace)

Every Studio or Buyer organization (`workspaces` row + `workspace_members`) supports
five canonical roles. The backend enum uses `owner | admin | editor | viewer`; the UI
maps `Manager → admin` and `Member → editor` so the vocabulary reads consistently for
enterprise customers without a migration.

| UI Role  | Backend value | Description                                                             |
| -------- | ------------- | ----------------------------------------------------------------------- |
| Owner    | `owner`       | Full control. Billing, storage, deletion, ownership transfer.           |
| Admin    | `admin`       | Manage members, productions, storage, invitations.                      |
| Manager  | `admin`       | Day-to-day operations, manage productions and members.                  |
| Member   | `editor`      | Create, edit, and ingest productions.                                   |
| Viewer   | `viewer`      | Read-only access to productions, media, and reports.                    |

- Owner is auto-assigned by a DB trigger on workspace creation.
- Invitations go through the existing `workspace-invite` edge function.
- Invite UI (`ProductionsManager.tsx` — Share dialog & Collaboration panel) reads its
  vocabulary from `INVITABLE_ORG_ROLES` / `ORG_ROLE_LABEL`.
- Write gate: `canWriteActive` (`useWorkspaces.tsx`) already permits `owner | admin | editor`.

---

## Layer 4 — Production Role (per production)

A user has **one account** but may hold **different Production Roles** across
different Productions. There is no separate "Technician" account type.

Assignments live on the existing `projects.crew` JSONB — no new table. The canonical
vocabulary (`PRODUCTION_ROLES` in `src/lib/rbac/labels.ts`) is:

Producer · Executive Producer · Director · Production Manager · DIT ·
Camera Operator · Camera Assistant · Editor · Assistant Editor · Colorist ·
VFX · Sound · QC · Delivery · Subtitle · Localization · Viewer

Production Roles are a scoped credit/assignment — they do **not** grant workspace-wide
privileges. Workspace access is still governed by Layer 3.

---

## Registration Flow

| Account Type | Sign-up CTA           | After first login                                      |
| ------------ | --------------------- | ------------------------------------------------------ |
| Creator      | Create Account        | Creator workspace, `/dashboard/content`.               |
| Studio       | Create Studio         | Studio workspace, `/dashboard/studio`.                 |
| Buyer        | Create Buyer Account  | Buyer workspace, `/dashboard/buyer`.                   |

Post-registration, every user can:

- Create an organization (auto-Owner via DB trigger).
- Join an existing organization (via `workspace-invite`).
- Receive email invitations.
- Be assigned an Organization Role (per workspace).
- Be assigned a Production Role (per production).

Platform Roles are **never** offered here. They are granted from
`/admin` → Roles & RBAC by an existing Platform Admin or Super Admin.

---

## Separation Guarantees

1. Account Type × Organization Role × Production Role are stored on different columns
   / tables and evaluated independently.
2. A public sign-up cannot obtain a Platform Role — the sign-up UI does not expose
   the option and the invite-only roles are gated by RLS on `user_roles`.
3. Organization Role changes never modify `user_roles`.
4. Production Role changes never modify `workspace_members` or `user_roles`.

## Non-Goals for this Document

- No new tables. No column changes. No new edge functions. No RLS changes.
- The existing invitation system (`workspace-invite`), authentication, RBAC engine
  (`has_role()`), and onboarding flows are reused unchanged.
