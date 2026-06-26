import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function QuickActionGrid({
  title,
  description,
  cols = 3,
  children,
  className,
}: {
  title?: string;
  description?: string;
  cols?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const colsCls =
    cols === 2 ? "sm:grid-cols-2"
    : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4"
    : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div>
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      )}
      <div className={cn("grid grid-cols-1 gap-3", colsCls)}>{children}</div>
    </section>
  );
}
