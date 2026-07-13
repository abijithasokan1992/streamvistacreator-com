import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { SUBMISSION_STEPS, type ProgressSnapshot } from "@/lib/submission";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Props {
  progress: ProgressSnapshot;
  currentStepId?: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

/**
 * Deterministic step tracker. Reads from computeProgress() output.
 * No AI. Highlights complete/current/upcoming states.
 */
export function StepProgress({ progress, currentStepId, onStepClick, className }: Props) {
  const { t } = useTranslation();
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {t("submission.progress.title", "Submission progress")}
        </span>
        <span className="text-muted-foreground">
          {progress.totalDone}/{progress.totalRequired} · {progress.percent}%
        </span>
      </div>
      <Progress value={progress.percent} />
      <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {SUBMISSION_STEPS.map((step, i) => {
          const result = progress.perStep.find((r) => r.step === step.id);
          const complete = result?.complete ?? false;
          const current = currentStepId === step.id;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
                  current && "border-primary bg-primary/5",
                  complete && !current && "border-emerald-500/50 bg-emerald-500/5",
                  !complete && !current && "border-border hover:bg-muted/50",
                )}
                aria-current={current ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    complete
                      ? "bg-emerald-500 text-white"
                      : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="truncate">{t(step.titleKey, step.id)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
