import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FieldGroup({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** When true, renders as a `<details>` element so the section can collapse
   *  inside the studio profile Edit Mode. Other consumers (creator profile,
   *  production settings) keep the original static section behaviour. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className="group rounded-xl border border-border/50 bg-card/40 p-4 md:p-6 [&[open]>summary_svg]:rotate-180"
      >
        <summary className="flex items-start justify-between gap-3 cursor-pointer list-none select-none">
          <div className="space-y-1">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <ChevronDown className="w-4 h-4 mt-1 text-muted-foreground shrink-0 transition-transform" />
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">{children}</div>
      </details>
    );
  }
  return (
    <section className="rounded-xl border border-border/50 bg-card/40 p-4 md:p-6 space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}
