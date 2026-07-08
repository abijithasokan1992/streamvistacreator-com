import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ActivityEvent {
  id: string;
  when: string;         // human-readable timestamp
  actor?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * StreamVista Activity Timeline — vertical stream of production events.
 * Not a social feed. Purely chronological operational history.
 */
export function ActivityTimeline({
  events,
  className,
  emptyText = "No activity yet.",
}: {
  events: ActivityEvent[];
  className?: string;
  emptyText?: string;
}) {
  if (!events.length) {
    return (
      <p className={cn("text-xs text-muted-foreground italic", className)}>{emptyText}</p>
    );
  }
  return (
    <ol className={cn("relative border-l border-border/50 pl-4 space-y-4", className)}>
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span
            className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-surface border border-accent/50"
            aria-hidden="true"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <p className="text-[10px] font-mono-tech uppercase tracking-[0.14em] text-muted-foreground">
            {e.when}{e.actor ? ` · ${e.actor}` : ""}
          </p>
          <p className="text-sm text-foreground mt-0.5">{e.title}</p>
          {e.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{e.description}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
