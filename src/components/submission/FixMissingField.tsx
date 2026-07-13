import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import type { StepValidationResult } from "@/lib/submission";
import { cn } from "@/lib/utils";

interface Props {
  step: StepValidationResult;
  onFix: (fieldKey: string) => void;
  className?: string;
}

/**
 * "Fix missing field" list — deterministic. Renders each missing field
 * on a step with a button that scrolls the caller to that input.
 */
export function FixMissingField({ step, onFix, className }: Props) {
  const { t } = useTranslation();
  if (step.complete) return null;
  return (
    <div className={cn("rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm", className)}>
      <div className="mb-2 flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
        {t("submission.fixMissing.title", "A few fields still need your attention")}
      </div>
      <ul className="space-y-1">
        {step.missing.map((m) => (
          <li key={m.key} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{m.key}</span>
            <Button size="sm" variant="ghost" onClick={() => onFix(m.key)}>
              {t("submission.fixMissing.cta", "Fix")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
