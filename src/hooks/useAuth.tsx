import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  // New role set
  | "super_admin"
  | "admin"
  | "content_owner"
  | "studio"
  | "buyer"
  | "localization_partner"
  | "distributor"
  // Legacy roles (still in DB, auto-mapped to new dashboards)
  | "executive_producer"
  | "creator"
  | "client"
  | "moderator"
  | "user";

const ROLE_ORDER: AppRole[] = [
  "super_admin",
  "admin",
  "content_owner",
  "studio",
  "distributor",
  "localization_partner",
  "buyer",
  // Legacy fall-through
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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      checkRole(data.session?.user?.id).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
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
    case "super_admin": return "/admin/super";
    case "admin": return "/admin";
    case "content_owner": return "/dashboard/content";
    case "studio": return "/dashboard/studio";
    case "buyer": return "/dashboard/buyer";
    case "localization_partner": return "/dashboard/localization";
    case "distributor": return "/dashboard/distribution";
    default: return "/dashboard/content";
  }
}
