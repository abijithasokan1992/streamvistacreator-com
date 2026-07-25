import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  // === MVP roles (the only roles the product surfaces) ===
  // Public signup
  | "content_owner"   // labelled "Creator" in UI
  | "studio"
  | "buyer"
  // Invite-only
  | "admin"
  | "super_admin"
  | "qc_reviewer"
  | "legal_reviewer"
  // === Dormant / Phase 2 — kept in the enum so existing rows still load,
  // but never offered through signup, dashboards, or admin UI. ===
  | "localization_partner"
  | "distributor"
  | "executive_producer"
  | "creator"
  | "client"
  | "moderator"
  | "user";

/** The 7 roles supported by the StreamVista MVP. */
export const MVP_PUBLIC_ROLES = ["content_owner", "studio", "buyer"] as const;
export const MVP_INVITE_ROLES = ["admin", "super_admin", "qc_reviewer", "legal_reviewer"] as const;
export const MVP_ROLES = [...MVP_PUBLIC_ROLES, ...MVP_INVITE_ROLES] as const;

const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "admin",
  "qc_reviewer",
  "legal_reviewer",
  "content_owner",
  "studio",
  "buyer",
  // Dormant fall-through
  "distributor",
  "localization_partner",
  "executive_producer",
  "creator",
  "moderator",
  "client",
  "user",
];


interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  /** Canonical dashboard role: legacy roles are mapped to the new ones. */
  dashboardRole: AppRole | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isQcReviewer: boolean;
  isLegalReviewer: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}


const Ctx = createContext<AuthCtx>({} as AuthCtx);

/** Highest-precedence role across new + legacy enums. */
function pickPrimary(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_ORDER) if (roles.includes(r)) return r;
  return null;
}

export function pickPrimaryRole(roles: AppRole[]): AppRole | null {
  return pickPrimary(roles);
}

/** Map legacy roles to their new-world equivalents for routing. */
function toDashboardRole(r: AppRole | null): AppRole | null {
  if (!r) return null;
  switch (r) {
    case "executive_producer":
    case "creator":
      return "content_owner";
    // Dormant Phase-2 roles no longer have their own dashboards.
    // Route distributors to buyer and localization partners to content_owner
    // so `dashboardForRole` never returns a URL that redirects back to itself.
    case "distributor":
      return "buyer";
    case "localization_partner":
      return "content_owner";
    case "client":
      return "buyer";
    case "moderator":
    case "user":
      return "buyer";
    default:
      return r;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const checkRole = async (uid: string | undefined) => {
    if (!uid) { setRole(null); return; }
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    const roles = (data || []).map((r: any) => r.role as AppRole);
    setRole(pickPrimary(roles));
  };

  const handleRefreshFailure = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
    setSession(null);
    setUser(null);
    setRole(null);
    setLoading(false);
    // Do NOT force a redirect here. Public pages (/, /partners, /contact,
    // /pricing, /auth) should keep rendering; auth-gated routes have their own
    // guards (OnboardingGate, RoleGate) that will send unauthenticated users
    // to /auth with a proper `next=` param. Force-redirecting from here was
    // the source of refresh-token loops on public surfaces.
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      const isProtectedShell =
        path.startsWith("/dashboard") ||
        path.startsWith("/admin") ||
        path.startsWith("/onboarding") ||
        path.startsWith("/my-workspace") ||
        path.startsWith("/studio") ||
        path.startsWith("/settings");
      if (isProtectedShell) {
        const next = encodeURIComponent(path + window.location.search);
        window.location.replace(`/auth?next=${next}&reason=session_expired`);
      }
    }
  };

  const isRefreshTokenError = (err: unknown): boolean => {
    const msg = (err as any)?.message?.toLowerCase?.() ?? "";
    const code = (err as any)?.code?.toLowerCase?.() ?? "";
    return (
      code === "refresh_token_not_found" ||
      msg.includes("refresh token not found") ||
      msg.includes("invalid refresh token") ||
      msg.includes("refresh_token_not_found")
    );
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (evt === "SIGNED_OUT" || (evt === "TOKEN_REFRESHED" && !s)) {
        if (!s) { handleRefreshFailure(); return; }
      }
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => checkRole(s?.user?.id), 0);
      if ((evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED") && s?.user?.id) {
        setTimeout(() => {
          supabase.from("user_profiles").update({
            last_active_at: new Date().toISOString(),
            idle_status: "active",
            idle_flagged_at: null,
            idle_frozen_at: null,
          }).eq("user_id", s.user!.id).then(() => {});
        }, 0);
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error && isRefreshTokenError(error)) {
        handleRefreshFailure();
        return;
      }
      setSession(data.session);
      setUser(data.session?.user ?? null);
      checkRole(data.session?.user?.id).finally(() => setLoading(false));
    }).catch((err) => {
      if (isRefreshTokenError(err)) handleRefreshFailure();
      else setLoading(false);
    });

    // Catch async refresh failures fired outside getSession()
    const onUnhandled = (e: PromiseRejectionEvent) => {
      if (isRefreshTokenError(e.reason)) {
        e.preventDefault();
        handleRefreshFailure();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("unhandledrejection", onUnhandled);
    }
    return () => {
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("unhandledrejection", onUnhandled);
      }
    };
  }, []);


  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase.auth"))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
    setSession(null);
    setUser(null);
    setRole(null);
    if (typeof window !== "undefined") {
      window.location.replace("/auth");
    }
  };
  const refreshRole = async () => { await checkRole(user?.id); };

  const dashboardRole = toDashboardRole(role);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        dashboardRole,
        isAdmin: role === "admin" || role === "super_admin",
        isSuperAdmin: role === "super_admin",
        isQcReviewer: role === "qc_reviewer",
        isLegalReviewer: role === "legal_reviewer",
        loading,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);

/** Canonical landing route for a given role (legacy roles supported). */
export function dashboardForRole(r: AppRole | null): string {
  const d = toDashboardRole(r);
  switch (d) {
    case "super_admin": return "/admin";
    case "admin": return "/admin";
    case "qc_reviewer": return "/admin/qc";
    case "legal_reviewer": return "/admin/legal";
    case "content_owner": return "/dashboard/content";
    case "studio": return "/dashboard/studio";
    case "buyer": return "/dashboard/buyer";
    // Dormant (Phase 2) roles still have routes so existing assignees aren't broken,
    // but are never offered through signup or admin UI.
    case "localization_partner": return "/dashboard/localization";
    case "distributor": return "/dashboard/distribution";
    // Unknown / unmapped role: send to onboarding so the user can pick a role
    // instead of bouncing into the admin console.
    default: return "/onboarding";
  }
}

/**
 * Every route dashboardForRole() can return. Kept in sync with App.tsx routers
 * and asserted in src/test/smoke/reviewer-routing.test.tsx so a role can never
 * be mapped to a URL that isn't registered.
 */
export const REGISTERED_DASHBOARD_ROUTES = [
  "/admin",
  "/admin/qc",
  "/admin/legal",
  "/admin/home",
  "/onboarding",
  "/dashboard/content",
  "/dashboard/studio",
  "/dashboard/buyer",
  "/dashboard/localization",
  "/dashboard/distribution",
] as const;

