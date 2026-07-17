/**
 * Workspace-scoped role helper (Phase D1 consolidation).
 *
 * The product treats an identity as potentially belonging to multiple
 * workspaces. Role, plan, entitlements and billing are workspace-scoped —
 * they must NOT be read from the global identity. This module keeps the
 * derivation tiny and side-effect-free so it can be unit-tested and
 * imported into any dashboard shell without pulling in Supabase.
 *
 * Inputs come from existing hooks (`useWorkspaces`, `useAuth`) — no new
 * queries and no schema changes.
 */
import type { AppRole } from "@/hooks/useAuth";
import type { Workspace, WorkspaceRole } from "@/hooks/useWorkspaces";

export interface WorkspaceScope {
  workspaceId: string | null;
  workspaceName: string | null;
  /** The user's role INSIDE the active workspace (owner/admin/editor/viewer). */
  workspaceRole: WorkspaceRole | null;
  /** The app-level dashboard role tied to this workspace (creator/studio/buyer/admin). */
  productRole: AppRole | null;
  canWrite: boolean;
  isOwner: boolean;
}

const WRITE_ROLES: WorkspaceRole[] = ["owner", "admin", "editor"];

/**
 * Derive a workspace-scoped view. `productRole` intentionally falls back to
 * the identity's dashboard role: workspaces do not yet carry their own
 * product-role column, but this helper is the seam where D2 can plug it in
 * without touching call sites.
 */
export function deriveWorkspaceScope(
  active: Workspace | null,
  identityRole: AppRole | null,
): WorkspaceScope {
  if (!active) {
    return {
      workspaceId: null,
      workspaceName: null,
      workspaceRole: null,
      productRole: identityRole ?? null,
      canWrite: false,
      isOwner: false,
    };
  }
  const workspaceRole = active.role ?? null;
  return {
    workspaceId: active.id,
    workspaceName: active.name,
    workspaceRole,
    productRole: identityRole ?? null,
    canWrite: !!workspaceRole && WRITE_ROLES.includes(workspaceRole),
    isOwner: workspaceRole === "owner",
  };
}
