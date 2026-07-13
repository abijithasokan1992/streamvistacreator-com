import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSave: () => void | Promise<void>;
  onContinue: () => void | Promise<void>;
  onBack?: () => void;
  saving?: boolean;
  canContinue?: boolean;
  className?: string;
}

/** Save & Continue bar. Zero AI. */
export function SaveContinue({
  onSave,
  onContinue,
  onBack,
  saving = false,
  canContinue = true,
  className,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div>
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
            {t("common.back", "Back")}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {t("common.save", "Save")}
        </Button>
        <Button type="button" onClick={onContinue} disabled={saving || !canContinue}>
          {t("common.continue", "Continue")}
        </Button>
      </div>
    </div>
  );
}
