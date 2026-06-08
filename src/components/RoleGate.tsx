import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, dashboardForRole, type AppRole } from "@/hooks/useAuth";

/**
 * Strict client-side gate. RLS still owns the real security boundary at the
 * database — this just keeps unauthorised users from seeing the wrong UI.
 */
export default function RoleGate({
  allow,
  children,
}: {
  allow: AppRole[];
  children: ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!role || !allow.includes(role)) return <Navigate to={dashboardForRole(role)} replace />;
  return <>{children}</>;
}
