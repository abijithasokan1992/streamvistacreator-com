# StreamVista Hybrid Product Mode — Implementation Plan

## Goal
Introduce two workspace modes for Creators without touching auth, plans, storage, or RBAC engine:
1. **Managed by StreamVista** (default) — simplified dashboard, StreamVista ops team runs the project on behalf of the customer.
2. **Self-Service Creator** — existing full Creator Workspace, unchanged.

Customer always remains project owner. StreamVista work is done through **scoped, audited operator permissions** — never by logging into customer accounts and never by creating hidden StreamVista-owned Creator accounts.

---

## Architecture

```text
                     ┌─────────────────────────┐
   Sign up ─────────▶│  Onboarding Mode Prompt │  (one question)
                     └───────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
     ┌────────────────┐                    ┌──────────────────┐
     │ Managed mode   │                    │ Self-Service     │
     │ (default)      │                    │ (advanced)       │
     └──────┬─────────┘                    └────────┬─────────┘
            │                                       │
            ▼                                       ▼
  Simplified dashboard                   Existing CreatorWorkspace
  (status/upload/messages/               (unchanged — every current
   approvals/billing/timeline/            section available)
   delivery/reports)
            │
            ▼
  Ops team works via
  /admin/managed-projects
  using operator_permissions
  scoped to (project, actions),
  logged in managed_ops_audit
```

---

## RBAC Matrix (delta only — no engine changes)

Layer 1 (Account Type) and Layer 3 (Org Role) are unchanged.

New capability layer, **stacked** on top of existing roles:

| Actor                          | Managed project — read | Upload / edit metadata / package / deliver on behalf of customer | Toggle managed mode | Assign operator | Access audit log |
| ------------------------------ | ---------------------- | ---------------------------------------------------------------- | ------------------- | --------------- | ---------------- |
| Project Owner (customer)       | ✓                      | ✓ (always — ownership never changes)                             | ✓                   | ✗               | ✓ (own project)  |
| Managed Ops Operator (staff)   | ✓ if assigned          | ✓ if assigned AND `managed_service_enabled` AND permission grants the action | ✗       | ✗               | ✓ (assigned)    |
| Managed Ops Lead (staff)       | ✓ all managed          | ✓ all managed                                                    | ✓                   | ✓               | ✓                |
| Platform Admin / Super Admin   | ✓                      | via emergency access (time-limited, reason required)             | ✓                   | ✓               | ✓                |

Enforced by a new SECURITY DEFINER function `public.can_operate_on_project(_user, _project, _action)` used in RLS. Existing `has_role()` stays untouched.

---

## Database Changes (single migration)

New enum:
- `managed_ops_action` — `upload | edit_metadata | create_version | qc | artwork | subtitle | rights | package | deliver | archive | report | approve`

New tables (all in `public`, all with GRANTs + RLS):

1. `user_workspace_mode(user_id PK → auth.users, mode text CHECK IN ('managed','self_service') default 'managed', decided_at, updated_at)` — remembered onboarding choice.
2. `managed_projects(project_id PK → projects.id, owner_id, enabled bool, assigned_team text, assigned_operator uuid, priority, due_date, status)`
3. `managed_project_permissions(id, project_id, operator_id, action managed_ops_action, granted_by, granted_at, revoked_at)` — scoped grants.
4. `managed_ops_audit(id, project_id, actor_id, actor_role text, action text, target text, metadata jsonb, created_at)` — every operator action.
5. `emergency_access_grants(id, project_id, admin_id, reason text NOT NULL, granted_at, expires_at, revoked_at)` — time-limited support access; RLS gate reads this.

Helpers:
- `public.is_managed_ops_lead(uuid)` and `public.can_operate_on_project(uuid, uuid, managed_ops_action)` — SECURITY DEFINER, `search_path = public`.
- Trigger `trg_managed_ops_audit_after_write` on `content_titles`, `title_media_versions`, `distribution_packages`, `distribution_deliveries` — writes an audit row when actor ≠ owner.

No changes to existing tables' ownership columns. No column rename. RLS on existing tables is **extended**, not replaced, with an added `OR can_operate_on_project(...)` clause where relevant.

Ops staff role is added to `app_role` if not present (`managed_ops_operator`, `managed_ops_lead`) — additive only.

---

## API / Edge Functions

No new edge functions required. New client-side helpers only:
- `src/lib/managed/modeApi.ts` — get/set user workspace mode.
- `src/lib/managed/managedProjectsApi.ts` — list/assign/toggle managed project (Ops UI).
- `src/lib/managed/auditApi.ts` — read audit trail for a project.

All calls go through existing Supabase client + RLS.

---

## Files Modified / Added

**Added**
- `supabase/migrations/<ts>_managed_service.sql` (single migration described above).
- `src/lib/managed/modeApi.ts`
- `src/lib/managed/managedProjectsApi.ts`
- `src/lib/managed/auditApi.ts`
- `src/components/onboarding/WorkspaceModePrompt.tsx` — the one-question chooser.
- `src/components/creator/managed/ManagedDashboard.tsx` — simplified 8-tile dashboard (Project Status / Upload / Messages / Approvals / Billing / Timeline / Delivery / Reports).
- `src/pages/admin/ManagedProjects.tsx` — Ops workspace listing (customer, project, status, operator, progress, priority, due date, Open).
- `src/components/admin/managed/EmergencyAccessDialog.tsx` — reason + duration form.
- `src/components/creator/settings/WorkspaceModeCard.tsx` — allow switching mode later.

**Modified (minimal)**
- `src/pages/Onboarding.tsx` — insert `WorkspaceModePrompt` step; skip if mode already recorded.
- `src/pages/dashboards/ContentOwner.tsx` — branch: `mode === 'managed'` → `<ManagedDashboard/>`, else existing workspace. Existing self-service path untouched.
- `src/components/creator/CreatorSidebar.tsx` — no structural change; only guard advanced sections behind `mode === 'self_service'` at render time (kept routable for staff).
- `src/lib/rbac/labels.ts` — add labels for `managed_ops_operator`, `managed_ops_lead`.
- Admin router (`AdminHome.tsx`) — add "Managed Projects" nav entry.

Unchanged: auth, plans, subscriptions, storage, billing edge functions, existing RLS on billing/storage/etc.

---

## Migration Plan

1. Ship migration (enum + 5 tables + helper functions + additive RLS clauses on 4 tables + audit triggers). No backfill required — existing users get `mode = 'managed'` on first prompt.
2. Deploy frontend changes behind an implicit flag: users with no `user_workspace_mode` row see the prompt; users who already onboarded stay on their current dashboard until they answer.
3. Seed a `managed_ops_lead` role for the first internal operator (manual insert via `supabase--insert` when the user provides the account).
4. Announce Managed Service in the app once the ops team is staffed.

## Rollback Plan

- Frontend: revert the modified files; the migration is additive so old UI keeps working.
- DB: `DROP TABLE` for the 5 new tables + `DROP FUNCTION` for the 2 helpers + `DROP TRIGGER` for the 4 audit triggers. Enum `managed_ops_action` dropped last. Existing tables untouched, so rollback is safe.

## Risk Assessment

| Risk                                          | Likelihood | Mitigation                                                                 |
| --------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| RLS regressions on `content_titles` etc.      | Medium     | Extend policies with `OR`, never replace. Add SQL tests in `tests/security`.|
| Operator acting outside scope                 | Low        | `can_operate_on_project` checks `managed_project_permissions` + not revoked.|
| Emergency access abused                       | Low        | Requires reason, expires automatically, visible in audit + admin list.     |
| Managed customer confused by hidden sections  | Low        | Explicit "Switch to Self-Service" card in Settings.                        |
| Attribution drift in audit                    | Low        | Trigger stamps `actor_id` from `auth.uid()`; owner vs operator resolved server-side.|

---

## End-to-End Journeys

**Managed customer**
1. Sign up → Creator role → sign in.
2. Onboarding asks the one question → picks Managed.
3. Lands on `ManagedDashboard` (8 tiles).
4. Creates a title (basic fields only), uploads media, watches Timeline + Delivery Status update as ops team works, approves milestones in Approvals, downloads Reports, pays via Billing.

**Self-service creator**
1. Same sign-up, picks Self-Service.
2. Lands on existing Creator Workspace — every current section available, nothing removed.
3. Can switch to Managed anytime from Workspace Settings.

**StreamVista operator**
1. Signs in with staff account holding `managed_ops_operator`.
2. Opens `/admin/managed-projects`, sees table (Customer, Project, Status, Operator, Progress, Priority, Due).
3. Clicks a project → opens the customer's managed project view under an operator context banner ("You are acting as StreamVista Operator on <Customer>'s project").
4. Every write is stamped in `managed_ops_audit` as `actor_role = 'streamvista_operator'`; owner never sees their own name on operator work.

**Emergency support (admin)**
1. Admin opens project, clicks "Request emergency access", enters reason + duration.
2. Row written to `emergency_access_grants`; RLS opens a time-limited window.
3. On expiry the grant is inert; audit trail preserved forever.

---

## Acceptance mapped to plan

- Managed default ✓ (default value on `user_workspace_mode.mode`).
- Self-service available ✓ (second option, switchable later).
- Ownership never changes ✓ (no writes to `projects.owner_id` / `content_titles.owner_id`).
- Operator permissions ✓ (`managed_project_permissions`).
- No hidden Creator account ✓ (staff use `managed_ops_operator` role).
- Full audit ✓ (`managed_ops_audit` + write triggers).
- Simplified dashboard ✓ (`ManagedDashboard`).
- Full workspace for self-service ✓ (existing components untouched).
- Existing subs/auth/storage/RBAC intact ✓ (additive migration only).

Approve to proceed and I will ship the migration first, then the frontend.
