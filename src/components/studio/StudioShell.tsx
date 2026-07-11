/**
 * StudioShell — MVP sidebar layout for the Studio dashboard.
 * Purely presentational: routes to a section id, renders a slim header,
 * and surfaces revenue CTAs (Buy Storage / Upgrade Plan) that the parent
 * wires to existing purchase flows. No backend logic changes here.
 */
import { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  LayoutDashboard, Clapperboard, UploadCloud, Database, Settings,
  LogOut, Menu, ShoppingCart, Crown, ShieldCheck, Loader2, ClipboardCheck,
} from "lucide-react";
import { useAuth, dashboardForRole } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type StudioSectionId =
  | "dashboard" | "productions" | "upload" | "dit" | "storage" | "settings";

const NAV: Array<{ id: StudioSectionId; label: string; icon: any }> = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "productions", label: "Productions", icon: Clapperboard },
  { id: "upload",      label: "Upload",      icon: UploadCloud },
  { id: "dit",         label: "DIT Protocol", icon: ClipboardCheck },
  { id: "storage",     label: "Storage",     icon: Database },
  { id: "settings",    label: "Settings",    icon: Settings },
];

export default function StudioShell({
  expectedRole = "studio",
  section,
  onSectionChange,
  onBuyStorage,
  onUpgradePlan,
  storagePct,
  children,
}: {
  expectedRole?: string;
  section: StudioSectionId;
  onSectionChange: (s: StudioSectionId) => void;
  onBuyStorage?: () => void;
  onUpgradePlan?: () => void;
  storagePct?: number;
  children?: ReactNode;
}) {
  const { user, role, dashboardRole, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <main className="min-h-dvh grid place-items-center bg-background text-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </main>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (dashboardRole && dashboardRole !== expectedRole && role !== "admin" && role !== "super_admin") {
    return <Navigate to={dashboardForRole(role)} replace />;
  }

  const nearFull = typeof storagePct === "number" && storagePct >= 80;

  const setSection = (s: StudioSectionId) => {
    onSectionChange(s);
    setMobileOpen(false);
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/40 sticky top-0 z-30 bg-background/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <Link to="/" className="text-sm font-semibold tracking-tight">StreamVista</Link>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 hidden sm:inline">Studio</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/dashboard/studio/profile"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Profile
            </Link>
            <button
              onClick={signOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside className={cn("md:block", mobileOpen ? "block" : "hidden", "md:sticky md:top-[64px] md:self-start")}>
          <nav className="rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-0.5">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = n.id === section;
              return (
                <button
                  key={n.id}
                  onClick={() => setSection(n.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
                    active
                      ? "bg-accent/[0.07] text-foreground ring-1 ring-inset ring-accent/20"
                      : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 truncate">{n.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Revenue CTAs — always visible */}
          <div className="mt-3 rounded-xl border border-border/50 bg-secondary/10 p-2 space-y-1">
            {onBuyStorage && (
              <button
                onClick={onBuyStorage}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors text-left",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50",
                  nearFull
                    ? "bg-amber-500/15 text-amber-200 hover:bg-amber-500/20"
                    : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground",
                )}
              >
                <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">Buy Storage</span>
              </button>
            )}
            {onUpgradePlan && (
              <button
                onClick={onUpgradePlan}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/30 hover:text-foreground transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              >
                <Crown className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">Upgrade Plan</span>
              </button>
            )}
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </main>
  );
}
