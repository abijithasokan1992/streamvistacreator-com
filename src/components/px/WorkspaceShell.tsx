import { Bell, LogOut, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UniversalSearch } from "./UniversalSearch";

/**
 * StreamVista Workspace Shell — the universal container for every
 * workspace (Creator, Studio, Buyer, Admin).
 *
 * Layout:
 *   Header (brand · universal search · notifications · account)
 *   ├─ Left rail (universal workspace navigation)
 *   ├─ Main   (context filters → content explorer → activity)
 *   └─ Right rail (details / quick actions / insights)
 *
 * Pure presentation. Slots are optional so pages can adopt the shell
 * incrementally without breaking existing functionality.
 */
export function WorkspaceShell({
  workspaceLabel,
  workspaceIdentifier,
  leftRail,
  header,
  filters,
  children,
  rightRail,
  onSearch,
  onNotifications,
  notificationsCount,
  accountName,
  onSignOut,
  className,
}: {
  workspaceLabel: string;
  workspaceIdentifier?: string;
  leftRail?: ReactNode;
  header?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
  rightRail?: ReactNode;
  onSearch?: (q: string) => void;
  onNotifications?: () => void;
  notificationsCount?: number;
  accountName?: string;
  onSignOut?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("min-h-dvh flex flex-col bg-background text-foreground", className)}>
      {/* Skip link is mounted at the app root; the shell exposes the target. */}

      {/* HEADER */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/85 backdrop-blur-xl px-4 h-14">
        <Link to="/" aria-label="StreamVista home" className="font-display font-black tracking-tight text-sm uppercase leading-none shrink-0">
          STREAM<span className="text-accent">VISTA</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-border/50">
          <span className="text-[10px] font-mono-tech uppercase tracking-[0.18em] text-muted-foreground">Workspace</span>
          <span className="text-sm font-medium">{workspaceLabel}</span>
          {workspaceIdentifier && (
            <span className="text-[10px] font-mono-tech text-muted-foreground/70">· {workspaceIdentifier}</span>
          )}
        </div>

        <div className="flex-1 max-w-xl mx-auto">
          <UniversalSearch onSubmit={onSearch} />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onNotifications}
            aria-label={notificationsCount ? `Notifications (${notificationsCount} unread)` : "Notifications"}
            className="relative rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
            {!!notificationsCount && notificationsCount > 0 && (
              <span aria-hidden="true" className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
          <ThemeToggle />
          {accountName && (
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground">
              <span className="max-w-[10ch] truncate">{accountName}</span>
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </div>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Sign out of StreamVista"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>
      </header>

      {header && (
        <div className="border-b border-border/40 bg-surface/30 px-6 py-3">
          {header}
        </div>
      )}

      {/* BODY */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_360px] min-h-0">
        {leftRail && (
          <aside
            role="navigation"
            aria-label="Workspace sections"
            className="hidden lg:flex flex-col border-r border-border/40 bg-surface/20 p-3 overflow-y-auto"
          >
            {leftRail}
          </aside>
        )}

        <main id="main-content" className="flex flex-col min-w-0">
          {filters && (
            <div className="px-6 py-3 border-b border-border/40 bg-background/70">
              {filters}
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </main>

        {rightRail && (
          <aside
            role="complementary"
            aria-label="Details and quick actions"
            className="hidden xl:flex flex-col border-l border-border/40 bg-surface/20 overflow-y-auto"
          >
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  );
}
