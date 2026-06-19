import { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, LogOut } from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";

/**
 * Honest, empty role dashboard.
 * No placeholder cards. We show only what's real: who you are and how to sign out.
 * Real modules will be wired in Phase 4.
 */
export default function RoleDashboardShell({
  expectedRole,
  title,
  subtitle,
  children,
}: {
  expectedRole: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  const { user, role, dashboardRole, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  // Wrong dashboard for this role → redirect to the right one.
  if (dashboardRole && dashboardRole !== expectedRole && role !== "admin" && role !== "super_admin") {
    return <Navigate to={dashboardForRole(role)} replace />;
  }

  const displayName =
    (user.user_metadata as Record<string, unknown> | undefined)?.full_name as string | undefined
    ?? user.email?.split("@")[0]
    ?? "there";

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            StreamVista
          </Link>
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-14">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">{title}</p>
        <h1 className="font-display text-3xl md:text-4xl mt-2">Welcome, {String(displayName)}.</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">{subtitle}</p>

        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 p-10 text-center">
      <h2 className="font-semibold text-base">{title}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
