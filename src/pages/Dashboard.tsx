import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, Film, Users, FolderOpen, Cloud, Archive, LayoutGrid } from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";

/**
 * Public dashboard for regular users (creator / executive_producer / client).
 * Admins are sent straight to /admin and never see this page.
 */
export default function Dashboard() {
  const { user, role, isAdmin, loading } = useAuth();

  // Bounce admins to their own console.
  if (!loading && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </main>
    );
  }

  // Not signed in → bounce to auth, asking it to come back here after login.
  if (!user) {
    return <Navigate to="/auth?next=/dashboard" replace />;
  }

  const roleLabel =
    role === "executive_producer"
      ? "Executive Producer"
      : role === "creator"
      ? "Creator"
      : role === "client"
      ? "Client"
      : "Member";

  const firstName =
    (user.user_metadata as Record<string, unknown> | undefined)?.first_name ??
    user.email?.split("@")[0] ??
    "there";

  const tiles = tilesForRole(role);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
        <header className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/70">
            {roleLabel} dashboard
          </p>
          <h1 className="font-display text-3xl md:text-4xl mt-2">
            Welcome back, {String(firstName)}.
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Jump into the parts of Cloud X you have access to. Your role determines which tools appear here.
          </p>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="group rounded-2xl border border-border/40 bg-secondary/20 hover:bg-secondary/40 hover:border-accent/50 transition-all p-5 flex flex-col gap-3"
            >
              <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent grid place-items-center">
                <t.icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-base">{t.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </div>
              <span className="mt-auto text-[11px] uppercase tracking-widest text-muted-foreground/60 group-hover:text-accent transition-colors">
                Open →
              </span>
            </Link>
          ))}
        </section>

        <footer className="mt-12 text-xs text-muted-foreground/70">
          Need a different role or workspace access? Contact your admin.
        </footer>
      </div>
    </main>
  );
}

type Tile = { to: string; title: string; desc: string; icon: typeof Film };

function tilesForRole(role: string | null): Tile[] {
  const projects: Tile = {
    to: "/projects",
    title: "Projects",
    desc: "Your active productions and collaborations.",
    icon: FolderOpen,
  };
  const studio: Tile = {
    to: "/studio",
    title: "Studio",
    desc: "Plan, schedule and produce together.",
    icon: LayoutGrid,
  };
  const archive: Tile = {
    to: "/archive",
    title: "Master Archive",
    desc: "Long-term storage for finished assets.",
    icon: Archive,
  };
  const team: Tile = {
    to: "/team",
    title: "Team",
    desc: "Invite collaborators and manage roles.",
    icon: Users,
  };
  const vault: Tile = {
    to: "/vault",
    title: "Vault",
    desc: "Secure private uploads and shares.",
    icon: Cloud,
  };
  const producer: Tile = {
    to: "/producer",
    title: "Producer Console",
    desc: "Oversee creators and approvals.",
    icon: Film,
  };
  const client: Tile = {
    to: "/client",
    title: "Client Workspace",
    desc: "Review deliveries shared with you.",
    icon: Users,
  };

  switch (role) {
    case "executive_producer":
      return [producer, projects, studio, team, archive];
    case "creator":
      return [projects, studio, vault, team, archive];
    case "client":
      return [client, projects];
    default:
      return [projects];
  }
}
