/**
 * RBAC display labels — single source of truth for user-facing role names.
 *
 * The backend enum values (public.app_role, workspace_members.role) are NOT
 * changed by this file. It maps existing internal values to the canonical
 * StreamVista taxonomy so every screen renders the same wording:
 *
 *   • Account Types      — Creator, Studio, Buyer          (public sign-up)
 *   • Platform Roles     — Super Admin, Platform Admin,    (invite-only)
 *                          Reviewer, Support
 *   • Organization Roles — Owner, Admin, Manager,          (per workspace)
 *                          Member, Viewer
 *   • Production Roles   — Producer, Director, DIT, …      (per production)
 *
 * Account Type × Organization Role × Production Role remain independent.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Account Types (public registration)
// ─────────────────────────────────────────────────────────────────────────────

/** Backend `app_role` values used for public account creation. */
export type AccountType = "content_owner" | "studio" | "buyer";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  content_owner: "Creator",
  studio: "Studio",
  buyer: "Buyer",
};

export const ACCOUNT_TYPES: AccountType[] = ["content_owner", "studio", "buyer"];

// ─────────────────────────────────────────────────────────────────────────────
// Platform Roles (invite-only staff)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical platform-role identifiers used in the UI vocabulary. */
export type PlatformRole = "super_admin" | "platform_admin" | "reviewer" | "support";

/** Map canonical UI role → the set of backend `app_role` values that satisfy it. */
export const PLATFORM_ROLE_BACKEND: Record<PlatformRole, readonly string[]> = {
  super_admin: ["super_admin"],
  platform_admin: ["admin"],
  reviewer: ["qc_reviewer", "legal_reviewer"],
  support: [], // Delivered via admin_staff_permissions / department = "operations".
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  super_admin: "Super Admin",
  platform_admin: "Platform Admin",
  reviewer: "Reviewer",
  support: "Support",
};

/** Given a backend `app_role`, resolve the canonical Platform Role bucket. */
export function platformRoleOf(appRole: string | null | undefined): PlatformRole | null {
  if (!appRole) return null;
  for (const [ui, values] of Object.entries(PLATFORM_ROLE_BACKEND) as Array<
    [PlatformRole, readonly string[]]
  >) {
    if (values.includes(appRole)) return ui;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Organization Roles (per workspace / studio / buyer org)
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical org-role identifiers surfaced in every workspace UI. */
export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

/**
 * Map canonical OrgRole → the backend `workspace_members.role` value we
 * actually persist. The backend currently supports {owner, admin, editor,
 * viewer}; `manager` and `member` are UI-layer refinements that reuse
 * `admin` and `editor` respectively so no migration is required.
 */
export const ORG_ROLE_BACKEND: Record<OrgRole, "owner" | "admin" | "editor" | "viewer"> = {
  owner: "owner",
  admin: "admin",
  manager: "admin",   // elevated org privileges; same backend row as admin
  member: "editor",   // standard collaborator
  viewer: "viewer",
};

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  member: "Member",
  viewer: "Viewer",
};

export const ORG_ROLE_DESCRIPTION: Record<OrgRole, string> = {
  owner: "Full control. Billing, storage, deletion, and ownership transfer.",
  admin: "Manage members, productions, storage, and invitations.",
  manager: "Run day-to-day operations and manage productions and members.",
  member: "Create, edit, and ingest productions within the workspace.",
  viewer: "Read-only access to productions, media, and reports.",
};

/** Org roles offered when inviting a collaborator (Owner is auto-assigned). */
export const INVITABLE_ORG_ROLES: OrgRole[] = ["admin", "manager", "member", "viewer"];

/** Display label for a raw workspace_members.role value. */
export function labelForOrgRole(raw: string | null | undefined): string {
  if (!raw) return "—";
  if (raw === "owner") return ORG_ROLE_LABEL.owner;
  if (raw === "admin") return ORG_ROLE_LABEL.admin;
  if (raw === "editor") return ORG_ROLE_LABEL.member;
  if (raw === "viewer") return ORG_ROLE_LABEL.viewer;
  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// Production Roles (per production; profile / crew credit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A user has one account but may hold different Production Roles across
 * different Productions. This vocabulary is UI-only — assignments are stored
 * on the existing `projects.crew` JSONB (no new table).
 */
export type ProductionRole =
  | "producer"
  | "executive_producer"
  | "director"
  | "production_manager"
  | "dit"
  | "camera_operator"
  | "camera_assistant"
  | "editor"
  | "assistant_editor"
  | "colorist"
  | "vfx"
  | "sound"
  | "qc"
  | "delivery"
  | "subtitle"
  | "localization"
  | "viewer";

export const PRODUCTION_ROLE_LABEL: Record<ProductionRole, string> = {
  producer: "Producer",
  executive_producer: "Executive Producer",
  director: "Director",
  production_manager: "Production Manager",
  dit: "DIT",
  camera_operator: "Camera Operator",
  camera_assistant: "Camera Assistant",
  editor: "Editor",
  assistant_editor: "Assistant Editor",
  colorist: "Colorist",
  vfx: "VFX",
  sound: "Sound",
  qc: "QC",
  delivery: "Delivery",
  subtitle: "Subtitle",
  localization: "Localization",
  viewer: "Viewer",
};

export const PRODUCTION_ROLES: ProductionRole[] = [
  "producer",
  "executive_producer",
  "director",
  "production_manager",
  "dit",
  "camera_operator",
  "camera_assistant",
  "editor",
  "assistant_editor",
  "colorist",
  "vfx",
  "sound",
  "qc",
  "delivery",
  "subtitle",
  "localization",
  "viewer",
];
