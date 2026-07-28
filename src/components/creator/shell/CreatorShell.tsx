import { Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import EntitlementChip from "@/components/creator/EntitlementChip";
import { CreatorSidebarNav, CREATOR_NAV } from "./CreatorSidebarNav";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default function CreatorShell() {
  const { signOut } = useAuth();
  const { pathname } = useLocation();
  const current = CREATOR_NAV.find((n) => pathname.startsWith(n.to));

  return (
    <SidebarProvider>
      <div className="min-h-dvh flex w-full bg-background text-foreground">
        <CreatorSidebarNav />
        <SidebarInset className="min-w-0 flex-1 flex flex-col">
          <header className="h-12 sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/85 backdrop-blur px-3 md:px-4">
            <div className="flex items-center gap-2 min-w-0">
              <SidebarTrigger className="shrink-0" />
              <Link to="/" className="text-sm font-semibold tracking-tight shrink-0">
                StreamVista
              </Link>
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
              <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground truncate">
                Creator Portal
              </span>
              {current && (
                <>
                  <span className="text-muted-foreground/40 hidden md:inline">/</span>
                  <span className="text-xs text-foreground/80 hidden md:inline">{current.label}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <NavLink
                to="/dashboard/content"
                className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                title="Switch back to the legacy Creator dashboard"
              >
                Classic view
              </NavLink>
              <EntitlementChip />
              <ThemeToggle />
              <button
                onClick={signOut}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 min-w-0 px-4 md:px-6 py-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
