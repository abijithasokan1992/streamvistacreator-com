import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DeptSubSection = {
  id: string;
  label: string;
  hint?: string;
  content: ReactNode;
};

/**
 * Renders a sticky secondary pill-nav for sub-sections inside an admin
 * department page, plus the active sub-section body. Each section gets a
 * stable id used for in-page anchoring + the command bar deep-link.
 */
export default function DeptSubNav({
  sections,
  activeId,
  onActiveChange,
}: {
  sections: DeptSubSection[];
  activeId?: string;
  onActiveChange?: (id: string) => void;
}) {
  const [internal, setInternal] = useState<string>(activeId ?? sections[0]?.id ?? "");

  useEffect(() => {
    if (activeId && activeId !== internal) setInternal(activeId);
  }, [activeId]);

  const setActive = (id: string) => {
    setInternal(id);
    onActiveChange?.(id);
  };

  const current = sections.find((s) => s.id === internal) ?? sections[0];

  return (
    <div className="space-y-5">
      <nav
        className="sticky top-[88px] z-20 -mx-2 px-2 py-2 backdrop-blur bg-background/70 border-b border-border/40"
        aria-label="Section navigation"
      >
        <div className="flex flex-wrap gap-1.5">
          {sections.map((s) => {
            const active = s.id === internal;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors border",
                  active
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "bg-secondary/30 text-muted-foreground border-border/40 hover:text-foreground hover:bg-secondary/50",
                )}
                title={s.hint}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      {current && (
        <section id={`section-${current.id}`} className="space-y-6 animate-fade-in">
          {current.content}
        </section>
      )}
    </div>
  );
}
