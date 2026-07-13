import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label with a locale-aware "required" marker. Zero AI. */
export function RequiredLabel({ htmlFor, required, children, className }: Props) {
  const { t } = useTranslation();
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium", className)}>
      {children}
      {required && (
        <span
          className="ml-1 text-destructive"
          aria-label={t("submission.field.required", "Required")}
        >
          *
        </span>
      )}
      {!required && (
        <span className="ml-2 text-xs text-muted-foreground">
          {t("submission.field.optional", "Optional")}
        </span>
      )}
    </label>
  );
}
