## Users & Credentials — admin tab

A 5th tab in the existing admin console (`/admin`) for full user lifecycle control, audit trail, and admin self-credentials.

### What the tab shows

A glassmorphic users table with:
- Filter toggle: **All users** / **Staff only** (admin · executive_producer · moderator)
- Search by email / name
- Columns: avatar, email, display name, primary role, plan tier, status (active / suspended), last sign-in, created
- Row actions: **View**, **Modify** (role + plan), **Hold** (suspend / unsuspend), **Delete**

A second card: **My admin credentials**
- Shows the admin URL (`/admin`) with copy button
- "Send me a password-reset link" button (uses Lovable auth recovery email)
- "Invite new admin" form (email → sends magic-link invite, role pre-set to `admin`)

A third card: **Audit log** — last 50 admin actions (who did what, when, on which user).

### What each button does

- **View** — slide-over drawer with full profile, all roles, plan, storage usage, referral code, last login, suspended flag, recent audit entries for this user.
- **Modify role / plan** — dialog with role multi-select and plan dropdown; writes through edge function, logs to audit.
- **Hold (suspend)** — toggles `user_profiles.is_suspended`; suspended users are blocked at `OnboardingGate` and on auth refresh (signed out client-side next nav). Reversible.
- **Delete** — confirm-text dialog ("type the email to confirm"); calls `auth.admin.deleteUser` via edge function; cascades to profile/roles via existing FK.
- **Full access & audit** — opens the audit log filtered to this user; admin already has full RLS bypass on every panel.

### Schema (one migration)

- `user_profiles.is_suspended boolean default false`
- New table `admin_audit_log` (admin_user_id, target_user_id, action, details jsonb, created_at) with admin-only SELECT, service-role INSERT.

### Edge function

`supabase/functions/admin-users/index.ts` (verify_jwt off, validates JWT + admin role in code, uses service role for `auth.admin.*`). Endpoints via a single POST + `{ action }` body:
- `list` (with optional `staffOnly`, `search`)
- `get` (full detail for one user)
- `setRolesAndPlan`
- `setSuspended`
- `deleteUser`
- `inviteAdmin` (calls `auth.admin.inviteUserByEmail`, then inserts `user_roles` row on confirmation via a DB trigger that already exists for default roles — extended to honour `app_metadata.invited_role`)
- `sendRecoveryToSelf`

Every mutating call writes an `admin_audit_log` row.

### Front-end files

- `src/pages/Admin.tsx` — add 5th `DeptTab` "Users & Credentials" + `TabsContent`.
- `src/components/admin/UsersAndCredentials.tsx` — table, drawer, modify/delete dialogs, suspend toggle, audit list.
- `src/components/admin/AdminSelfCredentials.tsx` — copy URL, reset-my-password, invite-new-admin form.
- `src/components/OnboardingGate.tsx` — also block when `is_suspended = true` (redirect to a "Account on hold" notice with sign-out).

### Guarantees

- All DB writes go through the service-role edge function; client never touches `auth.users`.
- Admin cannot delete or suspend themselves (server-side guard).
- Audit log is immutable from the client (no UPDATE/DELETE grants).
- Suspended users are signed out on next route navigation and cannot pass `OnboardingGate`.

### Out of scope (deferred)

- Bulk actions.
- Per-role storage quota overrides (already in plan/billing surface).
- 2FA enforcement (separate auth setting).
