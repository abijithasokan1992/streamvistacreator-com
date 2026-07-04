import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

export function ProfileSaveBar({
  dirty,
  saving,
  onSave,
  onReset,
  disabled,
  invalidMessage,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  disabled?: boolean;
  invalidMessage?: string | null;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 sm:gap-3 rounded-xl border border-border/60 bg-background/90 backdrop-blur px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg">
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 min-w-0">
        {invalidMessage ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span className="text-destructive truncate">{invalidMessage}</span>
          </>
        ) : (
          "Unsaved changes"
        )}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>Discard</Button>
        <Button size="sm" onClick={onSave} disabled={saving || disabled}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

