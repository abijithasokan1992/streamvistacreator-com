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
    <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/90 backdrop-blur px-4 py-3 shadow-lg">
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
        {invalidMessage ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-destructive">{invalidMessage}</span>
          </>
        ) : (
          "You have unsaved changes."
        )}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>Discard</Button>
        <Button size="sm" onClick={onSave} disabled={saving || disabled}>
          {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

