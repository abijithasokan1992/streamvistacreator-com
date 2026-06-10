import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Info, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type SystemMessageSeverity = "info" | "warning" | "error";

export interface SystemMessagePayload {
  title: string;
  message: string;
  severity?: SystemMessageSeverity;
  /** Free-form structured context shown to admin only (e.g. "uploadId=…"). */
  context?: string;
  /** Path the user was on when the message fired. Auto-filled if omitted. */
  page?: string;
  /** Hide the Report-to-Admin button for purely informational notices. */
  hideReport?: boolean;
  /** Custom label for the primary button. Defaults to "OK". */
  okLabel?: string;
  onOk?: () => void;
  /** Optional secondary action button shown between Report and OK (e.g. "Retry upload"). */
  extraAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    /** If true, closes the modal after onClick resolves. Defaults to true. */
    closeOnClick?: boolean;
  };
}

interface Ctx {
  showMessage: (p: SystemMessagePayload) => void;
}

const SystemMessageContext = createContext<Ctx | null>(null);

export function useSystemMessage() {
  const ctx = useContext(SystemMessageContext);
  if (!ctx) throw new Error("useSystemMessage must be used inside <SystemMessageProvider>");
  return ctx;
}

interface QueueItem extends SystemMessagePayload {
  id: number;
}

export function SystemMessageProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [reporting, setReporting] = useState(false);

  const current = queue[0] ?? null;

  const showMessage = useCallback((p: SystemMessagePayload) => {
    setQueue((q) => [...q, { ...p, id: Date.now() + Math.random() }]);
  }, []);

  const close = useCallback(() => {
    setQueue((q) => q.slice(1));
    setReporting(false);
  }, []);

  const handleOk = useCallback(() => {
    current?.onOk?.();
    close();
  }, [current, close]);

  const handleReport = useCallback(async () => {
    if (!current) return;
    setReporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("system-report", {
        body: {
          title: current.title,
          message: current.message,
          severity: current.severity ?? "info",
          context: current.context ?? "",
          page: current.page ?? (typeof window !== "undefined" ? window.location.pathname : ""),
        },
      });
      if (error || !data?.ok) {
        toast.error("Could not send report", { description: error?.message ?? data?.error });
        setReporting(false);
        return;
      }
      toast.success("Report sent to admin", {
        description: data.notifiedAdmins
          ? `${data.notifiedAdmins} admin${data.notifiedAdmins === 1 ? "" : "s"} notified.`
          : "Logged in the support inbox.",
      });
      close();
    } catch (e) {
      toast.error("Could not send report", { description: e instanceof Error ? e.message : String(e) });
      setReporting(false);
    }
  }, [current, close]);

  // Globally accessible helper for non-React call sites (rare).
  if (typeof window !== "undefined") {
    (window as unknown as { systemMessage?: Ctx["showMessage"] }).systemMessage = showMessage;
  }

  const value = useMemo<Ctx>(() => ({ showMessage }), [showMessage]);

  const severity = current?.severity ?? "info";
  const Icon = severity === "error" ? AlertCircle : severity === "warning" ? AlertTriangle : Info;
  const accent =
    severity === "error" ? "text-destructive bg-destructive/10 border-destructive/30" :
    severity === "warning" ? "text-amber-400 bg-amber-500/10 border-amber-500/30" :
    "text-accent bg-accent/10 border-accent/30";

  return (
    <SystemMessageContext.Provider value={value}>
      {children}
      <Dialog open={!!current} onOpenChange={(o) => { if (!o && !reporting) close(); }}>
        <DialogContent className="sm:max-w-md top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 fixed">
          <DialogHeader>
            <div className={cn("inline-flex items-center gap-2 w-fit px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wider mb-2", accent)}>
              <Icon className="w-3.5 h-3.5" />
              {severity === "error" ? "Error" : severity === "warning" ? "Warning" : "Notice"}
            </div>
            <DialogTitle className="font-display text-xl">{current?.title ?? ""}</DialogTitle>
            <DialogDescription className="whitespace-pre-wrap text-foreground/80">
              {current?.message ?? ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            {!current?.hideReport && (
              <Button
                type="button"
                variant="outline"
                onClick={handleReport}
                disabled={reporting}
                className="gap-2"
              >
                {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                Report to admin
              </Button>
            )}
            {current?.extraAction && (
              <Button
                type="button"
                variant="secondary"
                disabled={reporting}
                onClick={async () => {
                  const action = current.extraAction!;
                  try { await action.onClick(); }
                  finally { if (action.closeOnClick !== false) close(); }
                }}
              >
                {current.extraAction.label}
              </Button>
            )}
            <Button type="button" onClick={handleOk} disabled={reporting} className="bg-gradient-primary text-primary-foreground">
              {current?.okLabel ?? "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SystemMessageContext.Provider>
  );
}
