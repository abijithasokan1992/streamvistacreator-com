import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "executive_producer"
  | "creator"
  | "client"
  | "moderator"
  | "user";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAdmin: boolean;
  isExecutiveProducer: boolean;
  isCreator: boolean;
  isClient: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

/** Highest-precedence role (matches DB `public.primary_role`). */
function pickPrimary(roles: AppRole[]): AppRole | null {
  const order: AppRole[] = ["admin", "executive_producer", "creator", "moderator", "client", "user"];
  for (const r of order) if (roles.includes(r)) return r;
  return null;
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
      // Idle-tracker: keep last_active_at fresh + auto-unfreeze on real sign-in
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

  const signOut = async () => { await supabase.auth.signOut(); };
  const refreshRole = async () => { await checkRole(user?.id); };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        isAdmin: role === "admin",
        isExecutiveProducer: role === "executive_producer",
        isCreator: role === "creator",
        isClient: role === "client",
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

/** Default landing route for a given role. */
export function dashboardForRole(r: AppRole | null): string {
  switch (r) {
    case "admin": return "/admin";
    case "executive_producer": return "/producer";
    case "creator": return "/vault";
    case "client": return "/client";
    default: return "/client";
  }
}
