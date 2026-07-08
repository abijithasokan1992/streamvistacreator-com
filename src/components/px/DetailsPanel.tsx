import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusIndicator, type StatusKind } from "./StatusIndicator";

/**
 * StreamVista Details Panel — a right-rail context surface.
 * Users rarely leave the current screen; the panel exposes:
 *   Overview · Metadata · Assets · Versions · Rights · QC ·
 *   Storage · Timeline · Comments · Activity · History · Actions
 *
 * Pure presentation. The parent supplies tab content via `sections`.
 */
export interface DetailsSection {
  id: string;
  label: string;
  content: ReactNode;
}

export function DetailsPanel({
  open,
  title,
  subtitle,
  status,
  sections,
  activeSection,
  onSelectSection,
  onClose,
  className,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  status?: StatusKind;
  sections: DetailsSection[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  onClose?: () => void;
  className?: string;
}) {
  if (!open) return null;
  const current = sections.find((s) => s.id === activeSection) ?? sections[0];
  return (
    <aside
      role="complementary"
      aria-label={`Details for ${title}`}
      className={cn(
        "flex flex-col h-full w-full max-w-md border-l border-border/50 bg-surface/60 backdrop-blur-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 p-4 border-b border-border/40">
        <div className="min-w-0">
          {subtitle && (
            <p className="text-[10px] font-mono-tech uppercase tracking-[0.16em] text-muted-foreground">
              {subtitle}
            </p>
          )}
          <h2 className="font-display text-base font-semibold text-foreground mt-0.5 line-clamp-2">
            {title}
          </h2>
          {status && <div className="mt-2"><StatusIndicator kind={status} /></div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details panel"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>

      <nav
        aria-label="Details sections"
        className="flex overflow-x-auto border-b border-border/40 px-2"
      >
        {sections.map((s) => {
          const active = s.id === (current?.id);
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectSection?.(s.id)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
                active
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" className="flex-1 overflow-y-auto p-4 text-sm">
        {current?.content}
      </div>
    </aside>
  );
}
