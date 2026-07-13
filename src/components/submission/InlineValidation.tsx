import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import type { FieldValidationResult } from "@/lib/submission";
import { cn } from "@/lib/utils";

interface Props {
  result?: FieldValidationResult;
  className?: string;
}

/** Renders a validation error using i18n keys from validation.ts. No AI. */
export function InlineValidation({ result, className }: Props) {
  const { t } = useTranslation();
  if (!result || result.ok) return null;
  return (
    <p
      role="alert"
      className={cn(
        "mt-1 flex items-center gap-1 text-xs text-destructive",
        className,
      )}
    >
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      <span>{t(result.errorKey ?? "submission.validation.required", result.errorParams ?? {})}</span>
    </p>
  );
}
