import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/hooks/useLocale";
import { getHelp, type HelpTopicId } from "@/lib/submission";

interface Props {
  topic: HelpTopicId;
  /** Optional override for the trigger label. */
  label?: string;
}

/**
 * "Explain this" — reads from the STATIC bilingual help catalog.
 * Never calls the model. Adding a new topic: edit helpCatalog.ts.
 */
export function ExplainThis({ topic, label }: Props) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const text = getHelp(topic, locale === "ml" ? "ml" : "en");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label={t("submission.help.trigger", "Explain this")}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          {label ?? t("submission.help.trigger", "Explain this")}
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-sm text-sm leading-relaxed">
        {text || t("submission.help.missing", "No help available for this field yet.")}
      </PopoverContent>
    </Popover>
  );
}
