import { Link, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StreamVista Universal Workspace Navigation.
 * One consistent taxonomy across every workspace.
 * Routes are always passed by the parent — this component never
 * invents links, so existing route paths remain untouched.
 */
export interface WorkspaceNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onSelect?: () => void;
  badge?: number | string;
}

export interface WorkspaceNavGroup {
  id: string;
  label?: string;
  items: WorkspaceNavItem[];
}

export function WorkspaceNav({
  groups,
  activeId,
  compact = false,
  ariaLabel = "Workspace navigation",
}: {
  groups: WorkspaceNavGroup[];
  activeId?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.id}>
          {group.label && !compact && (
            <p className="px-3 mb-1.5 text-[10px] font-mono-tech uppercase tracking-[0.18em] text-muted-foreground/70">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id || (!!item.href && pathname === item.href);
              const cls = cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                active
                  ? "bg-accent/10 text-foreground border border-accent/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30 border border-transparent",
              );
              const inner = (
                <>
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                  {!compact && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge !== 0 && (
                        <span className="text-[10px] font-mono-tech rounded-full bg-secondary/60 text-foreground px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </>
              );
              return (
                <li key={item.id}>
                  {item.href ? (
                    <Link
                      to={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cls}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={item.onSelect}
                      aria-current={active ? "page" : undefined}
                      className={cn(cls, "w-full text-left")}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
