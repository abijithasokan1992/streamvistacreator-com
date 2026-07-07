import { X, Loader2 } from "lucide-react";
import { useState } from "react";

export type BulkAction = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  /** Called with the currently selected ids. Return promise to auto-show a spinner. */
  run: (ids: string[]) => void | Promise<void>;
};

/**
 * Sticky bar that appears above a list when at least one row is selected.
 * Drop-in for any admin console; the console still owns its per-row actions.
 */
export default function BulkActionBar({
  count, ids, onClear, actions,
}: {
  count: number;
  ids: string[];
  onClear: () => void;
  actions: BulkAction[];
}) {
  const [runningId, setRunningId] = useState<string | null>(null);
  if (count === 0) return null;

  const runAction = async (a: BulkAction) => {
    try {
      setRunningId(a.id);
      await a.run(ids);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="sticky top-14 z-30 mb-3 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 backdrop-blur px-3 py-2">
      <button onClick={onClear} aria-label="Clear selection" className="h-7 w-7 rounded-md hover:bg-background/40 grid place-items-center">
        <X className="w-4 h-4" />
      </button>
      <span className="text-xs font-semibold">
        {count} selected
      </span>
      <div className="ml-auto flex items-center gap-1.5 flex-wrap">
        {actions.map(a => (
          <button
            key={a.id}
            onClick={() => runAction(a)}
            disabled={runningId !== null}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              a.tone === "danger"
                ? "border border-red-500/40 text-red-300 hover:bg-red-500/10"
                : "border border-border/50 hover:border-accent/50"
            } disabled:opacity-50`}
          >
            {runningId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
