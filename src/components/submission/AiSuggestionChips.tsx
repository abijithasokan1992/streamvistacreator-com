import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { useLocale } from "@/hooks/useLocale";
import { AI_UNAVAILABLE_MESSAGE } from "@/lib/submission";
import { cn } from "@/lib/utils";

export interface AiSuggestion {
  value: string;
  selected?: boolean;
}

interface Props {
  /** Suggestions read from the CACHED metadata result. This component NEVER calls the model. */
  suggestions: AiSuggestion[];
  onToggle: (value: string) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  /** Set true when a rate limit / disabled state must be surfaced. */
  unavailable?: boolean;
  /** Timestamp of the cached generation for transparency. */
  generatedAt?: string | null;
  className?: string;
}

/**
 * Renders CACHED AI-generated tag suggestions as toggleable chips.
 * Regeneration is an explicit user action — no auto-refresh, no
 * per-keystroke calls.
 */
export function AiSuggestionChips({
  suggestions,
  onToggle,
  onRegenerate,
  regenerating = false,
  unavailable = false,
  generatedAt,
  className,
}: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  if (unavailable) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {locale === "ml" ? AI_UNAVAILABLE_MESSAGE.ml : AI_UNAVAILABLE_MESSAGE.en}
      </p>
    );
  }

  if (!suggestions.length) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {t("submission.chips.empty", "Finish the synopsis to see suggestions.")}
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        <span>{t("submission.chips.header", "Suggested tags")}</span>
        {generatedAt && (
          <span className="ml-auto opacity-70">
            {t("submission.chips.generatedAt", "Generated {{time}}", {
              time: new Date(generatedAt).toLocaleString(),
            })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onToggle(s.value)}
            aria-pressed={!!s.selected}
          >
            <Badge variant={s.selected ? "default" : "outline"} className="cursor-pointer">
              {s.value}
            </Badge>
          </button>
        ))}
      </div>
      {onRegenerate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRegenerate}
          disabled={regenerating}
          className="h-7 text-xs"
        >
          <RefreshCw className={cn("mr-1 h-3 w-3", regenerating && "animate-spin")} aria-hidden />
          {t("submission.chips.regenerate", "Regenerate suggestions")}
        </Button>
      )}
    </div>
  );
}
