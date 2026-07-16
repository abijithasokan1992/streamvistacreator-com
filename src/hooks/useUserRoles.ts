import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, dashboardForRole } from "@/hooks/useAuth";

/**
 * Returns the full set of roles held by the current user (not just the primary).
 * Used to route multi-role master accounts to the correct dashboard tier from
 * the public marketing surfaces (Navbar, Hero, RoleSurfaces, FinalCta).
 */
export function useUserRoles() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user?.id) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const has = (r: AppRole | AppRole[]) => {
    const list = Array.isArray(r) ? r : [r];
    return list.some((x) => roles.includes(x));
  };

  return {
    roles,
    loading: loading || authLoading,
    signedIn: !!user,
    has,
    isAdmin: has(["admin", "super_admin"]),
    /** Smart-link: if user holds `role`, return that dashboard route; else fallback. */
    routeFor(role: AppRole, fallback: string): string {
      if (!user) return fallback;
      if (roles.includes(role)) return dashboardForRole(role);
      // Any admin can enter any tier for oversight.
      if (has(["admin", "super_admin"])) return dashboardForRole(role);
      return fallback;
    },
  };
}
