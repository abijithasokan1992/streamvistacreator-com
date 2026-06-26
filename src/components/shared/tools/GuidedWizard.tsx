import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  /** Block "Next" until true. */
  canAdvance?: boolean;
};

export function GuidedWizard({
  steps,
  onFinish,
  finishLabel = "Finish",
  className,
}: {
  steps: WizardStep[];
  onFinish?: () => void;
  finishLabel?: string;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;
  const canAdvance = step?.canAdvance !== false;

  return (
    <div className={cn("rounded-xl border border-border/50 bg-card/40 p-4 backdrop-blur-sm", className)}>
      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-5">
        {steps.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.id} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                  done && "bg-emerald-500/20 text-emerald-300",
                  active && "bg-accent/20 text-accent ring-2 ring-accent/30",
                  !done && !active && "bg-secondary/40 text-muted-foreground",
                )}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs truncate hidden sm:inline",
                  active ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-border/40" />}
            </li>
          );
        })}
      </ol>

      {/* Body */}
      <div className="min-h-[120px]">
        {step?.description && (
          <p className="text-xs text-muted-foreground mb-3">{step.description}</p>
        )}
        {step?.content}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isFirst}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {isLast ? (
          <Button type="button" size="sm" disabled={!canAdvance} onClick={onFinish}>
            {finishLabel}
            <Check className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={!canAdvance}
            onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
