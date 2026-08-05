import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

/**
 * Strict client-side RBAC gate.
 *
 * Database RLS remains the authoritative security boundary. This component
 * must fail closed: a missing or disallowed role never renders protected UI,
 * even when a dashboard redirect would point back to the same route.
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

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  if (!role) {
    return <Navigate to="/auth/role-unknown?reason=no_role" replace />;
  }

  if (!allow.includes(role)) {
    return (
      <Navigate
        to={`/auth/role-unknown?reason=access_denied&from=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
