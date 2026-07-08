import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StreamVista Filter Bar — production-focused faceted filters.
 * Chip-based, keyboard accessible, WCAG 2.2 AA.
 */
export interface FilterChip {
  id: string;
  label: string;
  value?: string;
}

export function FilterBar({
  facets,
  active = [],
  onToggle,
  onClearAll,
  className,
}: {
  facets: FilterChip[];
  active?: string[];
  onToggle?: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}) {
  const hasActive = active.length > 0;
  return (
    <div
      role="toolbar"
      aria-label="Content filters"
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border border-border/50 bg-surface/40 p-2",
        className,
      )}
    >
      {facets.map((f) => {
        const isActive = active.includes(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onToggle?.(f.id)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              isActive
                ? "border-accent/60 bg-accent/10 text-foreground"
                : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <span>{f.label}</span>
            {f.value && <span className="text-muted-foreground/80">· {f.value}</span>}
          </button>
        );
      })}
      {hasActive && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Clear all filters"
        >
          <X className="w-3 h-3" aria-hidden="true" /> Clear
        </button>
      )}
    </div>
  );
}
