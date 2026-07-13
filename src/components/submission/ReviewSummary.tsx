import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SUBMISSION_STEPS, readField, type SubmissionPayload, type ProgressSnapshot } from "@/lib/submission";
import { cn } from "@/lib/utils";

interface Props {
  payload: SubmissionPayload;
  progress: ProgressSnapshot;
  className?: string;
}

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Deterministic review summary — renders saved data from the payload.
 * No AI. Used on the Review step and inside the submit confirmation.
 */
export function ReviewSummary({ payload, progress, className }: Props) {
  const { t } = useTranslation();
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">
          {t("submission.reviewSummary.title", "Review your submission")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {SUBMISSION_STEPS.map((step) => {
          const stepResult = progress.perStep.find((r) => r.step === step.id);
          return (
            <div key={step.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{t(step.titleKey, step.id)}</span>
                <span
                  className={cn(
                    "text-xs",
                    stepResult?.complete ? "text-emerald-600" : "text-amber-600",
                  )}
                >
                  {stepResult?.complete
                    ? t("submission.reviewSummary.complete", "Complete")
                    : t("submission.reviewSummary.incomplete", "Incomplete")}
                </span>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {step.fields.map((f) => (
                  <div key={f.key} className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">{f.key}</dt>
                    <dd className="truncate font-medium">{formatValue(readField(payload, f.key))}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
