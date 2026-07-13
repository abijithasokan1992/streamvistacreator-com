import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { NextAction } from "@/lib/submission";
import { cn } from "@/lib/utils";

interface Props {
  next: NextAction;
  onGo: (stepId: string) => void;
  className?: string;
}

/**
 * Displays the deterministically picked next step.
 * No AI — reads from pickNextAction().
 */
export function NextActionCard({ next, onGo, className }: Props) {
  const { t } = useTranslation();
  const isReady = next.submissionReady;
  return (
    <Card className={cn(isReady ? "border-emerald-500/40 bg-emerald-500/5" : "", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {isReady ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <ArrowRight className="h-5 w-5 text-primary" />
          )}
          {t(next.labelKey, isReady ? "Ready for review" : "Finish this step")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isReady && next.missingFieldKeys.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("submission.nextAction.missing", "Missing: {{fields}}", {
              fields: next.missingFieldKeys.join(", "),
            })}
          </p>
        )}
        <Button onClick={() => onGo(next.stepId)} size="sm">
          {isReady
            ? t("submission.nextAction.reviewCta", "Review & submit")
            : t("submission.nextAction.goCta", "Go to step")}
        </Button>
      </CardContent>
    </Card>
  );
}
